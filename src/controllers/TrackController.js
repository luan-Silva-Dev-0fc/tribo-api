const trackModel = require('../models/trackModel');
const { uploadToR2, deleteFromR2 } = require('../services/cloudflare');
const { logger } = require('../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Tenta extrair a duração em segundos a partir de um buffer de áudio
 */
async function extractAudioDuration(buffer) {
  return new Promise((resolve) => {
    try {
      const tempPath = path.join(os.tmpdir(), `temp-track-${Date.now()}-${Math.random().toString(36).substring(7)}.tmp`);
      fs.writeFileSync(tempPath, buffer);

      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (e) {}

        if (err || !metadata || !metadata.format || !metadata.format.duration) {
          return resolve(0);
        }
        resolve(Number(metadata.format.duration) || 0);
      });
    } catch (err) {
      resolve(0);
    }
  });
}

/**
 * GET /api/users/me/tracks
 * Lista e pesquisa músicas na galeria pessoal do usuário
 */
async function listUserTracks(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { query, q, search, limit = 50, offset = 0, page = 1 } = req.query;

    const searchTerm = query || q || search || '';
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedOffset = offset ? parseInt(offset, 10) : (Math.max(1, parseInt(page, 10)) - 1) * parsedLimit;

    const tracks = await trackModel.getUserTracks(userId, {
      query: searchTerm,
      limit: parsedLimit,
      offset: parsedOffset
    });

    return res.status(200).json({
      success: true,
      query: searchTerm,
      total: tracks.length,
      tracks
    });
  } catch (err) {
    logger.error('Erro ao listar faixas do usuário:', err);
    next(err);
  }
}

/**
 * POST /api/users/me/tracks
 * Cadastro/Upload de nova música na galeria pessoal
 */
async function createTrack(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    let { title, artist, file_url, fileUrl, duration, cover_url, coverUrl } = req.body;

    let finalFileUrl = file_url || fileUrl;
    let finalDuration = Number(duration) || 0;
    let finalCoverUrl = cover_url || coverUrl || null;

    // Se houver arquivo enviado via multipart/form-data
    if (req.file) {
      const isAudio = req.file.mimetype.startsWith('audio/') ||
                      /\.(mp3|wav|m4a|aac|ogg|flac|opus|webm)$/i.test(req.file.originalname);

      if (!isAudio) {
        return res.status(400).json({
          success: false,
          message: 'O arquivo enviado deve ser um formato de áudio válido (MP3, WAV, AAC, M4A, OGG, FLAC).'
        });
      }

      // Se a duração não foi enviada pelo cliente, tenta extrair via ffprobe
      if (!finalDuration) {
        finalDuration = await extractAudioDuration(req.file.buffer);
      }

      const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadResult = await uploadToR2({
        buffer: req.file.buffer,
        fileName,
        contentType: req.file.mimetype || 'audio/mpeg',
        folder: 'tracks'
      });

      finalFileUrl = uploadResult.url;

      // Se o título não foi preenchido, usa o nome do arquivo limpo
      if (!title) {
        title = path.parse(req.file.originalname).name;
      }
    }

    if (!finalFileUrl) {
      return res.status(400).json({
        success: false,
        message: 'A URL do arquivo de áudio (file_url) ou upload de arquivo é obrigatório.'
      });
    }

    if (!title || String(title).trim() === '') {
      title = 'Música Sem Título';
    }

    const track = await trackModel.createTrack({
      userId,
      title: String(title).trim(),
      artist: artist ? String(artist).trim() : 'Desconhecido',
      fileUrl: finalFileUrl,
      duration: finalDuration,
      coverUrl: finalCoverUrl
    });

    return res.status(201).json({
      success: true,
      message: 'Música adicionada com sucesso à sua galeria.',
      track
    });
  } catch (err) {
    logger.error('Erro ao cadastrar música:', err);
    next(err);
  }
}

/**
 * DELETE /api/users/me/tracks/:id
 * Remove uma faixa da galeria pessoal do usuário
 */
async function deleteTrack(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;

    const track = await trackModel.getTrackById(id);
    if (!track) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada.'
      });
    }

    if (track.user_id !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para excluir esta música.'
      });
    }

    const deleted = await trackModel.deleteTrack(id, userId);

    if (deleted && deleted.file_url) {
      // Tenta remover o arquivo do Cloudflare R2 em background
      deleteFromR2(deleted.file_url).catch((err) =>
        logger.warn('Falha ao deletar arquivo do R2:', err.message)
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Música removida da sua galeria com sucesso.'
    });
  } catch (err) {
    logger.error('Erro ao excluir música:', err);
    next(err);
  }
}

module.exports = {
  listUserTracks,
  createTrack,
  deleteTrack
};
