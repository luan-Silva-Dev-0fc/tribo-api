import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

export function useGroupAudioSync({ socket, groupId, currentUser, onPermissionError }) {
  const [audioState, setAudioState] = useState({
    groupId,
    is_playing: false,
    current_track: null,
    position_ms: 0,
    queue_list: [],
    server_time: Date.now()
  });

  const [isMuted, setIsMuted] = useState(false);
  const [localProgressMs, setLocalProgressMs] = useState(0);
  const soundRef = useRef(null);
  const currentUrlRef = useRef(null);

  const isGold = Boolean(
    currentUser?.badge_type === 'GOLD' ||
    currentUser?.badge_type === 'GOLD_VERIFIED' ||
    currentUser?.badge === 'GOLD' ||
    currentUser?.is_gold ||
    currentUser?.is_vip ||
    currentUser?.role === 'ADMIN'
  );

  // Configura Background Audio no Expo
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    }).catch(console.warn);
  }, []);

  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
      currentUrlRef.current = null;
    }
  };

  // Atualização contínua do progresso da barra
  useEffect(() => {
    let timer = null;
    if (audioState.is_playing && audioState.current_track) {
      timer = setInterval(() => {
        setLocalProgressMs((prev) => {
          const maxMs = (audioState.current_track?.duration || 0) * 1000;
          if (maxMs > 0 && prev >= maxMs) return maxMs;
          return prev + 500;
        });
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [audioState.is_playing, audioState.current_track]);

  // Sincronização inteligente com compensação de latência e drift
  const syncPlayback = useCallback(async (state) => {
    const track = state.current_track || state.currentTrack;
    const isPlaying = Boolean(state.is_playing ?? state.isPlaying);
    const basePositionMs = Number(state.position_ms ?? state.positionMs ?? 0);

    const latency = Math.max(0, (Date.now() - (state.server_time || Date.now())) / 2);
    const targetMs = basePositionMs + (isPlaying ? latency : 0);

    setLocalProgressMs(targetMs);

    if (!track || !track.file_url) {
      await unloadSound();
      return;
    }

    try {
      if (currentUrlRef.current !== track.file_url || !soundRef.current) {
        await unloadSound();

        const { sound } = await Audio.Sound.createAsync(
          { uri: track.file_url },
          {
            shouldPlay: isPlaying && !isMuted,
            positionMillis: Math.floor(targetMs),
            isMuted: isMuted
          },
          (status) => {
            if (status.isLoaded && status.positionMillis !== undefined) {
              setLocalProgressMs(status.positionMillis);
            }
          }
        );

        soundRef.current = sound;
        currentUrlRef.current = track.file_url;
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const currentPos = status.positionMillis || 0;
          const drift = Math.abs(currentPos - targetMs);

          // Corrige apenas desvios superiores a 500ms
          if (drift > 500) {
            await soundRef.current.setPositionAsync(Math.floor(targetMs));
          }

          if (isPlaying && !status.isPlaying) {
            await soundRef.current.playAsync();
          } else if (!isPlaying && status.isPlaying) {
            await soundRef.current.pauseAsync();
          }
        }
      }
    } catch (err) {
      console.warn('[useGroupAudioSync] Falha ao sincronizar áudio:', err);
    }
  }, [isMuted]);

  // Conexão Socket.io
  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit('join_group_audio', { groupId });

    const handleState = (state) => {
      setAudioState(state);
      syncPlayback(state);
    };

    const handleError = (err) => {
      if (onPermissionError) {
        onPermissionError(err.message || 'Acesso restrito ao Selo Dourado.');
      }
    };

    socket.on('group-audio-state', handleState);
    socket.on('queue_updated', handleState);
    socket.on('group-audio-error', handleError);

    return () => {
      socket.emit('leave_group_audio', { groupId });
      socket.off('group-audio-state', handleState);
      socket.off('queue_updated', handleState);
      socket.off('group-audio-error', handleError);
      unloadSound();
    };
  }, [socket, groupId, syncPlayback, onPermissionError]);

  const play = () => {
    if (!isGold) return;
    socket?.emit('playback_play', { groupId, user: currentUser });
  };

  const pause = () => {
    if (!isGold) return;
    socket?.emit('playback_pause', { groupId, user: currentUser });
  };

  const skip = () => {
    if (!isGold) return;
    socket?.emit('playback_skip', { groupId, user: currentUser });
  };

  const addToQueue = (track) => {
    if (!isGold) return;
    socket?.emit('queue_add', { groupId, track, user: currentUser });
  };

  const removeFromQueue = (trackId) => {
    if (!isGold) return;
    socket?.emit('queue_remove', { groupId, trackId, user: currentUser });
  };

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (soundRef.current) {
      await soundRef.current.setIsMutedAsync(nextMuted);
    }
  };

  return {
    audioState,
    isGold,
    isMuted,
    localProgressMs,
    play,
    pause,
    skip,
    addToQueue,
    removeFromQueue,
    toggleMute
  };
}
