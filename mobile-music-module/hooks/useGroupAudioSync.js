import { useState, useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import { getChatSocket } from "../services/chatSocket";

// SINGLETON GLOBAL DE ÁUDIO
let globalSound = null;
let globalTrackUrl = null;
let globalOpId = 0;
let globalIsLoading = false;
let globalLoadedAt = 0;

async function destroyGlobalSound() {
  globalOpId++;
  if (globalSound) {
    const s = globalSound;
    globalSound = null;
    globalTrackUrl = null;
    globalIsLoading = false;
    globalLoadedAt = 0;
    try {
      await s.stopAsync();
    } catch (_) {}
    try {
      await s.unloadAsync();
    } catch (_) {}
  }
}

export function useGroupAudioSync({ groupId, currentUser, onPermissionError }) {
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

  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const onPermissionErrorRef = useRef(onPermissionError);
  onPermissionErrorRef.current = onPermissionError;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const lastProgressUpdateRef = useRef(0);

  const isGold = Boolean(
    currentUser?.badge_type === "GOLD" ||
    currentUser?.badge_type === "GOLD_VERIFIED" ||
    currentUser?.badge === "GOLD" ||
    currentUser?.is_gold ||
    currentUser?.is_vip ||
    currentUser?.role === "ADMIN" ||
    currentUser?.email?.toLowerCase() === "luansilva@gmail.com"
  );

  // 1. Configuração otimizada do motor de áudio
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false
    }).catch(console.warn);
  }, []);

  // 2. Motor de Sincronização Estável
  const applyAudioState = useCallback(async (state) => {
    if (!state) return;
    setAudioState(state);

    const track = state.current_track || state.currentTrack;
    const isPlaying = Boolean(state.is_playing ?? state.isPlaying);
    const basePositionMs = Number(state.position_ms ?? state.positionMs ?? 0);

    if (!track || !track.file_url) {
      await destroyGlobalSound();
      setLocalProgressMs(0);
      return;
    }

    const trackUrl = track.file_url;
    const latency = Math.max(0, (Date.now() - (state.server_time || Date.now())) / 2);
    const targetMs = basePositionMs + (isPlaying ? latency : 0);

    // CASO 1: Mesma música já carregada no player
    if (globalSound && globalTrackUrl === trackUrl && !globalIsLoading) {
      try {
        const status = await globalSound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying && !status.isPlaying) {
            await globalSound.playAsync();
          } else if (!isPlaying && status.isPlaying) {
            await globalSound.pauseAsync();
          }

          const timeSinceLoad = Date.now() - globalLoadedAt;
          if (timeSinceLoad > 6000) {
            const currentPos = status.positionMillis || 0;
            const drift = Math.abs(currentPos - targetMs);
            if (drift > 4000) {
              await globalSound.setPositionAsync(Math.floor(targetMs));
            }
          }
        }
      } catch (e) {}
      return;
    }

    // CASO 2: Nova música a carregar
    if (globalIsLoading && globalTrackUrl === trackUrl) {
      return;
    }

    const thisOp = ++globalOpId;
    globalIsLoading = true;
    globalTrackUrl = trackUrl;

    try {
      if (globalSound) {
        const prev = globalSound;
        globalSound = null;
        try {
          await prev.stopAsync();
          await prev.unloadAsync();
        } catch (_) {}
      }

      if (thisOp !== globalOpId) {
        globalIsLoading = false;
        return;
      }

      const initialPos = targetMs > 5000 ? Math.floor(targetMs) : 0;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        {
          shouldPlay: isPlaying && !isMutedRef.current,
          positionMillis: initialPos,
          isMuted: isMutedRef.current,
          progressUpdateIntervalMillis: 800
        },
        (status) => {
          if (status.isLoaded && status.positionMillis !== undefined) {
            const now = Date.now();
            if (now - lastProgressUpdateRef.current > 700) {
              lastProgressUpdateRef.current = now;
              setLocalProgressMs(status.positionMillis);
            }
          }
        }
      );

      if (thisOp !== globalOpId) {
        try {
          await newSound.stopAsync();
          await newSound.unloadAsync();
        } catch (_) {}
        globalIsLoading = false;
        return;
      }

      globalSound = newSound;
      globalTrackUrl = trackUrl;
      globalLoadedAt = Date.now();
      globalIsLoading = false;
    } catch (err) {
      globalIsLoading = false;
      console.warn("[useGroupAudioSync] Erro ao carregar som:", err.message);
    }
  }, []);

  const applyAudioStateRef = useRef(applyAudioState);
  applyAudioStateRef.current = applyAudioState;

  // 3. Socket Conexão ESTÁVEL - Executa APENAS quando o groupId muda
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket || !groupId) return;

    socket.emit("join_group_audio", { groupId });

    const handleState = (state) => {
      if (applyAudioStateRef.current) {
        applyAudioStateRef.current(state);
      }
    };

    const handleError = (err) => {
      if (onPermissionErrorRef.current) {
        onPermissionErrorRef.current(err.message || "Acesso restrito ao Selo Dourado.");
      }
    };

    socket.on("group-audio-state", handleState);
    socket.on("group-audio-error", handleError);

    return () => {
      socket.emit("leave_group_audio", { groupId });
      socket.off("group-audio-state", handleState);
      socket.off("group-audio-error", handleError);
      destroyGlobalSound();
    };
  }, [groupId]); // NUNCA reinicia com re-renderizações!

  const play = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_play", { groupId, user: currentUserRef.current });
  };

  const pause = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_pause", { groupId, user: currentUserRef.current });
  };

  const skip = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_skip", { groupId, user: currentUserRef.current });
  };

  const addToQueue = (track) => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("queue_add", { groupId, track, user: currentUserRef.current });
  };

  const removeFromQueue = (trackId) => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("queue_remove", { groupId, trackId, user: currentUserRef.current });
  };

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (globalSound) {
      try {
        await globalSound.setIsMutedAsync(nextMuted);
      } catch (_) {}
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
