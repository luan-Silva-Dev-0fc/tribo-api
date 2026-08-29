const groupAudioService = require('../services/groupAudioService');
const groupModel = require('../models/groupModel');
const trackModel = require('../models/trackModel');
const { logger } = require('../utils/logger');

/**
 * GET /api/groups/:groupId/queue
 * Consulta o status atual do player e da fila de músicas do grupo
 */
async function getGroupQueue(req, res, next) {
  try {
    const { groupId, id } = req.params;
    const resolvedGroupId = groupId || id;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(resolvedGroupId, userId);
    if (!isMember && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Você precisa ser membro do grupo para visualizar a fila de reprodução.'
      });
    }

    const state = groupAudioService.getState(resolvedGroupId);

    return res.status(200).json({
      success: true,
      ...state
    });
  } catch (err) {
    logger.error('Erro ao obter fila do grupo:', err);
    next(err);
  }
}

/**
 * POST /api/groups/:groupId/queue
 * Adiciona uma faixa à fila de músicas do grupo (Apenas Selo Dourado)
 */
async function addToGroupQueue(req, res, next) {
  try {
    const { groupId, id } = req.params;
    const resolvedGroupId = groupId || id;
    const userId = req.user?.id || req.userId;
    const { trackId, track_id, title, artist, file_url, fileUrl, duration, cover_url, coverUrl } = req.body;

    const isMember = await groupModel.isGroupMember(resolvedGroupId, userId);
    if (!isMember && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Você precisa ser membro do grupo para interagir com o player.'
      });
    }

    let trackData = {
      title,
      artist,
      file_url: file_url || fileUrl,
      duration: Number(duration) || 0,
      cover_url: cover_url || coverUrl
    };

    // Se forneceu ID de uma música já cadastrada na galeria
    const targetTrackId = trackId || track_id;
    if (targetTrackId) {
      const existingTrack = await trackModel.getTrackById(targetTrackId);
      if (existingTrack) {
        trackData = {
          id: existingTrack.id,
          title: existingTrack.title,
          artist: existingTrack.artist,
          file_url: existingTrack.file_url,
          duration: existingTrack.duration,
          cover_url: existingTrack.cover_url
        };
      }
    }

    if (!trackData.file_url) {
      return res.status(400).json({
        success: false,
        message: 'É necessário fornecer a URL do áudio ou um ID de música válido.'
      });
    }

    const state = groupAudioService.addToQueue(resolvedGroupId, trackData, req.user);

    return res.status(200).json({
      success: true,
      message: 'Música adicionada à fila com sucesso.',
      ...state
    });
  } catch (err) {
    logger.error('Erro ao adicionar música à fila do grupo:', err);
    next(err);
  }
}

/**
 * POST /api/groups/:groupId/playback/:action
 * Executa ações de controle (play, pause, skip) - Apenas Selo Dourado
 */
async function controlPlayback(req, res, next) {
  try {
    const { groupId, id, action } = req.params;
    const resolvedGroupId = groupId || id;
    const resolvedAction = String(action || req.body.action || '').toLowerCase();

    let state;
    if (resolvedAction === 'play' || resolvedAction === 'resume') {
      state = groupAudioService.play(resolvedGroupId);
    } else if (resolvedAction === 'pause') {
      state = groupAudioService.pause(resolvedGroupId);
    } else if (resolvedAction === 'skip' || resolvedAction === 'next') {
      state = groupAudioService.skip(resolvedGroupId);
    } else if (resolvedAction === 'clear') {
      state = groupAudioService.clearQueue(resolvedGroupId);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Ação de reprodução inválida. Utilize "play", "pause", "skip" ou "clear".'
      });
    }

    return res.status(200).json({
      success: true,
      action: resolvedAction,
      ...state
    });
  } catch (err) {
    logger.error('Erro ao controlar reprodução de áudio do grupo:', err);
    next(err);
  }
}

module.exports = {
  getGroupQueue,
  addToGroupQueue,
  controlPlayback
};
