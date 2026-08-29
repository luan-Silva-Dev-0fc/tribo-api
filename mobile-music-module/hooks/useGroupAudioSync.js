import { useState, useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import { getChatSocket } from "../services/chatSocket";

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

  const soundRef = useRef(null);
  const currentUrlRef = useRef(null);
  const isLoadingRef = useRef(false);
  const operationIdRef = useRef(0);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const isGold = Boolean(
    currentUser?.badge_type === "GOLD" ||
    currentUser?.badge_type === "GOLD_VERIFIED" ||
    currentUser?.badge === "GOLD" ||
    currentUser?.is_gold ||
    currentUser?.is_vip ||
    currentUser?.role === "ADMIN" ||
    currentUser?.email?.toLowerCase() === "luansilva@gmail.com"
  );

  // 1. Configura Background Audio no Expo
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    }).catch(console.warn);
  }, []);

  // 2. Função segura para descarregar o som atual
  const safelyUnloadSound = async () => {
    const existingSound = soundRef.current;
    soundRef.current = null;
    currentUrlRef.current = null;

    if (existingSound) {
      try {
        await existingSound.stopAsync();
      } catch (_) {}
      try {
        await existingSound.unloadAsync();
      } catch (_) {}
    }
  };

  // 3. Atualização do timer da barra de progresso
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

  // 4. Motor de sincronização com Lock Anti-Duplicação
  const syncPlayback = useCallback(async (state) => {
    const track = state.current_track || state.currentTrack;
    const isPlaying = Boolean(state.is_playing ?? state.isPlaying);
    const basePositionMs = Number(state.position_ms ?? state.positionMs ?? 0);

    // Compensação de latência
    const latency = Math.max(0, (Date.now() - (state.server_time || Date.now())) / 2);
    const targetMs = basePositionMs + (isPlaying ? latency : 0);

    setLocalProgressMs(targetMs);

    // Se nenhuma música está na reprodução
    if (!track || !track.file_url) {
      operationIdRef.current++;
      await safelyUnloadSound();
      return;
    }

    const currentOp = ++operationIdRef.current;
    const trackUrl = track.file_url;

    // Caso A: Já é a mesma música e o som já está carregado -> apenas sincroniza
    const activeSound = soundRef.current;
    if (activeSound && currentUrlRef.current === trackUrl && !isLoadingRef.current) {
      try {
        const status = await activeSound.getStatusAsync();
        if (currentOp !== operationIdRef.current) return;

        if (status.isLoaded) {
          const currentPos = status.positionMillis || 0;
          const drift = Math.abs(currentPos - targetMs);

          // Ajusta posição apenas com desvio grande (> 600ms) para evitar gaguejo
          if (drift > 600) {
            await activeSound.setPositionAsync(Math.floor(targetMs));
          }

          if (isPlaying && !status.isPlaying) {
            await activeSound.playAsync();
          } else if (!isPlaying && status.isPlaying) {
            await activeSound.pauseAsync();
          }
        }
      } catch (err) {
        console.warn("[useGroupAudioSync] Aviso ao ajustar posição:", err.message);
      }
      return;
    }

    // Caso B: Nova música precisa ser carregada (com trava anti-duplicação)
    if (isLoadingRef.current && currentUrlRef.current === trackUrl) {
      return; // Já está carregando esta mesma música
    }

    isLoadingRef.current = true;
    currentUrlRef.current = trackUrl;

    try {
      // Para e descarrega qualquer som tocando antes de criar o novo
      await safelyUnloadSound();
      if (currentOp !== operationIdRef.current) {
        isLoadingRef.current = false;
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        {
          shouldPlay: isPlaying && !isMutedRef.current,
          positionMillis: Math.floor(targetMs),
          isMuted: isMutedRef.current,
          progressUpdateIntervalMillis: 500
        },
        (status) => {
          if (status.isLoaded && status.positionMillis !== undefined) {
            setLocalProgressMs(status.positionMillis);
          }
        }
      );

      // Se uma nova operação foi disparada enquanto baixava, descarta este som
      if (currentOp !== operationIdRef.current) {
        try {
          await newSound.stopAsync();
          await newSound.unloadAsync();
        } catch (_) {}
        isLoadingRef.current = false;
        return;
      }

      soundRef.current = newSound;
      currentUrlRef.current = trackUrl;
      isLoadingRef.current = false;
    } catch (err) {
      isLoadingRef.current = false;
      console.warn("[useGroupAudioSync] Falha ao carregar faixa:", err.message);
    }
  }, []);

  // 5. Conexão Socket.io
  useEffect(() => {
    const socket = getChatSocket();
    if (!socket || !groupId) return;

    socket.emit("join_group_audio", { groupId });

    const handleState = (state) => {
      setAudioState(state);
      syncPlayback(state);
    };

    const handleError = (err) => {
      if (onPermissionError) {
        onPermissionError(err.message || "Acesso restrito ao Selo Dourado.");
      }
    };

    socket.on("group-audio-state", handleState);
    socket.on("queue_updated", handleState);
    socket.on("group-audio-error", handleError);

    return () => {
      socket.emit("leave_group_audio", { groupId });
      socket.off("group-audio-state", handleState);
      socket.off("queue_updated", handleState);
      socket.off("group-audio-error", handleError);
      operationIdRef.current++;
      safelyUnloadSound();
    };
  }, [groupId, syncPlayback, onPermissionError]);

  const play = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_play", { groupId, user: currentUser });
  };

  const pause = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_pause", { groupId, user: currentUser });
  };

  const skip = () => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("playback_skip", { groupId, user: currentUser });
  };

  const addToQueue = (track) => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("queue_add", { groupId, track, user: currentUser });
  };

  const removeFromQueue = (trackId) => {
    if (!isGold) return;
    const socket = getChatSocket();
    socket?.emit("queue_remove", { groupId, trackId, user: currentUser });
  };

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    const currentSound = soundRef.current;
    if (currentSound) {
      try {
        await currentSound.setIsMutedAsync(nextMuted);
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
