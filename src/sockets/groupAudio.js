const groupAudioService = require('../services/groupAudioService');
const { isGoldUser } = require('../middlewares/goldBadge');
const { findUserById } = require('../models/authModel');
const { logger } = require('../utils/logger');

/**
 * Inicializa os handlers de WebSockets para a transmissão e sincronização de músicas no grupo
 */
function initializeGroupAudioSocket(io) {
  // Conecta a instância do Socket.io ao serviço de estado
  groupAudioService.setIo(io);

  io.on('connection', (socket) => {
    /**
     * Auxiliar para obter dados do usuário do socket ou do payload
     */
    async function resolveUser(payload) {
      if (socket.user) return socket.user;
      const u = payload?.user || {};
      const userId = u.id || payload?.userId;
      if (userId) {
        try {
          const dbUser = await findUserById(userId);
          if (dbUser) return dbUser;
        } catch (e) {}
      }
      return u;
    }

    /**
     * 1. Entrada na sala de áudio sincronizado do grupo
     * Eventos suportados: 'join_group_audio' e 'join-group-audio'
     */
    const handleJoinGroupAudio = (payload, callback) => {
      const groupId = String(payload?.groupId || payload?.group_id || payload?.room || payload || '');
      if (!groupId) return;

      const audioRoom = `group-audio:${groupId}`;
      socket.join(audioRoom);
      socket.join(groupId); // Também entra na sala geral do grupo para interoperabilidade

      const state = groupAudioService.getState(groupId);

      // Responde com o estado atual e timestamp para cálculo exato de latência
      socket.emit('group-audio-state', {
        ...state,
        reason: 'initial_sync'
      });

      if (typeof callback === 'function') {
        callback({ success: true, ...state });
      }

      logger.info(`[Socket Audio] Usuário conectou ao stream de áudio do grupo ${groupId}`);
    };

    socket.on('join_group_audio', handleJoinGroupAudio);
    socket.on('join-group-audio', handleJoinGroupAudio);

    /**
     * 2. Saída da sala de áudio
     */
    const handleLeaveGroupAudio = (payload) => {
      const groupId = String(payload?.groupId || payload?.group_id || payload?.room || payload || '');
      if (groupId) {
        socket.leave(`group-audio:${groupId}`);
      }
    };

    socket.on('leave_group_audio', handleLeaveGroupAudio);
    socket.on('leave-group-audio', handleLeaveGroupAudio);

    /**
     * 3. Adicionar faixa à fila de reprodução (Requer Selo Dourado)
     * Eventos: 'queue_add' e 'group-audio-add-queue'
     */
    const handleQueueAdd = async (payload, callback) => {
      try {
        const groupId = String(payload?.groupId || payload?.group_id || payload?.room || '');
        const track = payload?.track || payload;
        const user = await resolveUser(payload);

        if (!groupId || !track) {
          if (typeof callback === 'function') callback({ success: false, message: 'Dados insuficientes.' });
          return;
        }

        // Validação de Permissão do Selo Dourado
        if (!isGoldUser(user)) {
          const errMsg = 'Acesso restrito: Apenas usuários com Selo Dourado podem adicionar faixas à fila do grupo.';
          socket.emit('group-audio-error', {
            error: 'FORBIDDEN_GOLD_ONLY',
            action: 'queue_add',
            message: errMsg
          });
          if (typeof callback === 'function') callback({ success: false, error: 'FORBIDDEN_GOLD_ONLY', message: errMsg });
          return;
        }

        const state = groupAudioService.addToQueue(groupId, track, user);

        if (typeof callback === 'function') {
          callback({ success: true, message: 'Faixa adicionada à fila.', ...state });
        }
      } catch (err) {
        logger.error('[WS queue_add error]:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    };

    socket.on('queue_add', handleQueueAdd);
    socket.on('group-audio-add-queue', handleQueueAdd);

    /**
     * 4. Iniciar / Despausar reprodução (Requer Selo Dourado)
     * Eventos: 'playback_play' e 'group-audio-play'
     */
    const handlePlaybackPlay = async (payload, callback) => {
      try {
        const groupId = String(payload?.groupId || payload?.group_id || payload?.room || '');
        const user = await resolveUser(payload);

        if (!isGoldUser(user)) {
          const errMsg = 'Acesso restrito: Apenas usuários com Selo Dourado podem controlar a reprodução.';
          socket.emit('group-audio-error', {
            error: 'FORBIDDEN_GOLD_ONLY',
            action: 'playback_play',
            message: errMsg
          });
          if (typeof callback === 'function') callback({ success: false, error: 'FORBIDDEN_GOLD_ONLY', message: errMsg });
          return;
        }

        const state = groupAudioService.play(groupId);
        if (typeof callback === 'function') callback({ success: true, ...state });
      } catch (err) {
        logger.error('[WS playback_play error]:', err);
      }
    };

    socket.on('playback_play', handlePlaybackPlay);
    socket.on('group-audio-play', handlePlaybackPlay);

    /**
     * 5. Pausar reprodução (Requer Selo Dourado)
     * Eventos: 'playback_pause' e 'group-audio-pause'
     */
    const handlePlaybackPause = async (payload, callback) => {
      try {
        const groupId = String(payload?.groupId || payload?.group_id || payload?.room || '');
        const user = await resolveUser(payload);

        if (!isGoldUser(user)) {
          const errMsg = 'Acesso restrito: Apenas usuários com Selo Dourado podem pausar a transmissão.';
          socket.emit('group-audio-error', {
            error: 'FORBIDDEN_GOLD_ONLY',
            action: 'playback_pause',
            message: errMsg
          });
          if (typeof callback === 'function') callback({ success: false, error: 'FORBIDDEN_GOLD_ONLY', message: errMsg });
          return;
        }

        const state = groupAudioService.pause(groupId);
        if (typeof callback === 'function') callback({ success: true, ...state });
      } catch (err) {
        logger.error('[WS playback_pause error]:', err);
      }
    };

    socket.on('playback_pause', handlePlaybackPause);
    socket.on('group-audio-pause', handlePlaybackPause);

    /**
     * 6. Pular faixa (Requer Selo Dourado)
     * Eventos: 'playback_skip' e 'group-audio-skip'
     */
    const handlePlaybackSkip = async (payload, callback) => {
      try {
        const groupId = String(payload?.groupId || payload?.group_id || payload?.room || '');
        const user = await resolveUser(payload);

        if (!isGoldUser(user)) {
          const errMsg = 'Acesso restrito: Apenas usuários com Selo Dourado podem pular faixas.';
          socket.emit('group-audio-error', {
            error: 'FORBIDDEN_GOLD_ONLY',
            action: 'playback_skip',
            message: errMsg
          });
          if (typeof callback === 'function') callback({ success: false, error: 'FORBIDDEN_GOLD_ONLY', message: errMsg });
          return;
        }

        const state = groupAudioService.skip(groupId);
        if (typeof callback === 'function') callback({ success: true, ...state });
      } catch (err) {
        logger.error('[WS playback_skip error]:', err);
      }
    };

    socket.on('playback_skip', handlePlaybackSkip);
    socket.on('group-audio-skip', handlePlaybackSkip);

    /**
     * 7. Remover item da fila / Limpar fila (Requer Selo Dourado)
     */
    socket.on('queue_remove', async (payload, callback) => {
      try {
        const groupId = String(payload?.groupId || payload?.group_id || '');
        const trackId = payload?.trackId || payload?.index;
        const user = await resolveUser(payload);

        if (!isGoldUser(user)) {
          const errMsg = 'Acesso restrito: Apenas usuários com Selo Dourado podem alterar a fila.';
          socket.emit('group-audio-error', { error: 'FORBIDDEN_GOLD_ONLY', message: errMsg });
          if (typeof callback === 'function') callback({ success: false, message: errMsg });
          return;
        }

        const state = groupAudioService.removeFromQueue(groupId, trackId);
        if (typeof callback === 'function') callback({ success: true, ...state });
      } catch (err) {
        logger.error('[WS queue_remove error]:', err);
      }
    });

    /**
     * 8. Consulta de estado sob demanda via WS
     */
    socket.on('get_group_audio_state', (payload, callback) => {
      const groupId = String(payload?.groupId || payload?.group_id || payload?.room || '');
      if (groupId) {
        const state = groupAudioService.getState(groupId);
        socket.emit('group-audio-state', state);
        if (typeof callback === 'function') callback(state);
      }
    });
  });
}

module.exports = {
  initializeGroupAudioSocket
};
