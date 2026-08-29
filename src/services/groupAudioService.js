const { logger } = require('../utils/logger');

/**
 * Gerenciador de Estado e Sincronização em Tempo Real de Áudio/Músicas nos Grupos
 */
class GroupAudioService {
  constructor() {
    // Armazena o estado do player de cada grupo: Map<groupId, RoomState>
    this.rooms = new Map();
    this.io = null;
  }

  setIo(ioInstance) {
    this.io = ioInstance;
  }

  getOrCreateRoom(groupId) {
    const roomId = String(groupId);
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        groupId: roomId,
        isPlaying: false,
        currentTrack: null,
        startedAt: null,
        pausedAtMs: 0,
        queue: [],
        timer: null
      });
    }
    return this.rooms.get(roomId);
  }

  /**
   * Calcula a posição atual da música em milissegundos
   */
  calculateCurrentPosition(room) {
    if (!room.currentTrack) return 0;
    const durationMs = (room.currentTrack.duration || 0) * 1000;

    if (!room.isPlaying || !room.startedAt) {
      return Math.min(durationMs, room.pausedAtMs || 0);
    }

    const elapsed = Date.now() - room.startedAt;
    const currentPos = (room.pausedAtMs || 0) + elapsed;

    if (durationMs > 0 && currentPos >= durationMs) {
      return durationMs;
    }

    return currentPos;
  }

  /**
   * Retorna o snapshot do estado serializado para o frontend/clientes
   */
  getState(groupId) {
    const room = this.getOrCreateRoom(groupId);
    const positionMs = this.calculateCurrentPosition(room);

    return {
      groupId: String(groupId),
      is_playing: room.isPlaying,
      isPlaying: room.isPlaying,
      current_track: room.currentTrack,
      currentTrack: room.currentTrack,
      position_ms: positionMs,
      positionMs: positionMs,
      queue_list: room.queue,
      queueList: room.queue,
      queue_count: room.queue.length,
      server_time: Date.now()
    };
  }

  /**
   * Agenda a troca automática para a próxima faixa quando a atual terminar
   */
  scheduleNextTrack(room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    if (!room.isPlaying || !room.currentTrack) return;

    const durationMs = (room.currentTrack.duration || 0) * 1000;
    if (durationMs <= 0) {
      // Se não tiver duração cadastrada, define timeout padrão de segurança (3 minutos)
      return;
    }

    const currentPos = this.calculateCurrentPosition(room);
    const remainingMs = Math.max(200, durationMs - currentPos);

    room.timer = setTimeout(() => {
      this.handleTrackEnded(room.groupId);
    }, remainingMs);
  }

  /**
   * Trata o fim de uma faixa (avanço automático)
   */
  handleTrackEnded(groupId) {
    const room = this.getOrCreateRoom(groupId);

    logger.info(`[GroupAudio] Faixa encerrada no grupo ${groupId}. Verificando fila...`);

    if (room.queue.length > 0) {
      const nextTrack = room.queue.shift();
      room.currentTrack = nextTrack;
      room.isPlaying = true;
      room.startedAt = Date.now();
      room.pausedAtMs = 0;

      this.scheduleNextTrack(room);
      this.broadcastState(groupId, 'track_changed');
    } else {
      room.currentTrack = null;
      room.isPlaying = false;
      room.startedAt = null;
      room.pausedAtMs = 0;
      if (room.timer) clearTimeout(room.timer);
      room.timer = null;

      this.broadcastState(groupId, 'playback_ended');
    }
  }

  /**
   * Adiciona uma música à fila do grupo
   */
  addToQueue(groupId, trackData, user) {
    const room = this.getOrCreateRoom(groupId);

    const formattedTrack = {
      id: trackData.id || String(Date.now()),
      title: trackData.title || 'Música Sem Título',
      artist: trackData.artist || 'Artista Desconhecido',
      file_url: trackData.file_url || trackData.fileUrl || trackData.url,
      fileUrl: trackData.file_url || trackData.fileUrl || trackData.url,
      duration: Number(trackData.duration) || 0,
      cover_url: trackData.cover_url || trackData.coverUrl || null,
      coverUrl: trackData.cover_url || trackData.coverUrl || null,
      added_at: Date.now(),
      added_by: {
        id: user.id,
        name: user.name || user.username || 'Membro VIP',
        username: user.username || '',
        avatar_url: user.avatar_url || '',
        badge_type: user.badge_type || user.badge || 'GOLD'
      }
    };

    // Se nenhuma música estiver tocando e não houver faixa atual, inicia imediatamente
    if (!room.currentTrack) {
      room.currentTrack = formattedTrack;
      room.isPlaying = true;
      room.startedAt = Date.now();
      room.pausedAtMs = 0;
      this.scheduleNextTrack(room);
    } else {
      room.queue.push(formattedTrack);
    }

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'queue_updated');
    return state;
  }

  /**
   * Inicia ou retoma a reprodução da música
   */
  play(groupId) {
    const room = this.getOrCreateRoom(groupId);

    // Se não há música atual mas há itens na fila, pega o primeiro
    if (!room.currentTrack && room.queue.length > 0) {
      room.currentTrack = room.queue.shift();
      room.pausedAtMs = 0;
    }

    if (!room.currentTrack) {
      return this.getState(groupId);
    }

    if (!room.isPlaying) {
      room.isPlaying = true;
      room.startedAt = Date.now();
      this.scheduleNextTrack(room);
    }

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'playback_play');
    return state;
  }

  /**
   * Pausa a reprodução mantendo o timestamp atual
   */
  pause(groupId) {
    const room = this.getOrCreateRoom(groupId);

    if (room.isPlaying) {
      room.pausedAtMs = this.calculateCurrentPosition(room);
      room.isPlaying = false;
      room.startedAt = null;

      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = null;
      }
    }

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'playback_pause');
    return state;
  }

  /**
   * Pula para a próxima música da fila
   */
  skip(groupId) {
    const room = this.getOrCreateRoom(groupId);

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    if (room.queue.length > 0) {
      room.currentTrack = room.queue.shift();
      room.isPlaying = true;
      room.startedAt = Date.now();
      room.pausedAtMs = 0;
      this.scheduleNextTrack(room);
    } else {
      room.currentTrack = null;
      room.isPlaying = false;
      room.startedAt = null;
      room.pausedAtMs = 0;
    }

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'playback_skip');
    return state;
  }

  /**
   * Remove uma faixa específica da fila pelo índice ou ID
   */
  removeFromQueue(groupId, trackIndexOrId) {
    const room = this.getOrCreateRoom(groupId);

    if (typeof trackIndexOrId === 'number') {
      if (trackIndexOrId >= 0 && trackIndexOrId < room.queue.length) {
        room.queue.splice(trackIndexOrId, 1);
      }
    } else {
      room.queue = room.queue.filter((item) => item.id !== String(trackIndexOrId));
    }

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'queue_updated');
    return state;
  }

  /**
   * Limpa toda a fila de espera do grupo
   */
  clearQueue(groupId) {
    const room = this.getOrCreateRoom(groupId);
    room.queue = [];

    const state = this.getState(groupId);
    this.broadcastState(groupId, 'queue_updated');
    return state;
  }

  /**
   * Emite broadcast do estado via Socket.io para todos os usuários conectados na sala do grupo
   */
  broadcastState(groupId, eventReason = 'state_change') {
    const io = this.io || global.io;
    if (!io) return;

    const roomId = String(groupId);
    const state = this.getState(groupId);

    // Emite para a sala específica de áudio e para a sala geral do grupo
    io.to(`group-audio:${roomId}`).emit('group-audio-state', {
      ...state,
      reason: eventReason
    });

    io.to(roomId).emit('group-audio-state', {
      ...state,
      reason: eventReason
    });

    // Também emite eventos específicos convenientes
    if (eventReason === 'queue_updated') {
      io.to(roomId).emit('queue_updated', state);
      io.to(`group-audio:${roomId}`).emit('queue_updated', state);
    }
  }
}

// Instância singleton para manter a consistência do estado em memória
const groupAudioService = new GroupAudioService();

module.exports = groupAudioService;
