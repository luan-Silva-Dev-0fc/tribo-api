const reelsModel = require('../models/reelsModel');
const reelsService = require('../services/reelsService');

async function getCategories(req, res, next) {
  try {
    const categories = reelsModel.getAvailableCategories();
    return res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
}

async function getPreferences(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    const preferences = await reelsModel.getUserPreferences(userId);
    const allCategories = reelsModel.getAvailableCategories();

    return res.status(200).json({
      success: true,
      onboardingCompleted: preferences.onboardingCompleted,
      selectedCategories: preferences.selectedCategories,
      categoryScores: preferences.categoryScores,
      customPrompt: preferences.customPrompt || '',
      availableCategories: allCategories
    });
  } catch (error) {
    next(error);
  }
}

async function savePreferences(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    const { selectedCategories, customPrompt } = req.body;

    if ((!Array.isArray(selectedCategories) || selectedCategories.length === 0) && (!customPrompt || !customPrompt.trim())) {
      return res.status(400).json({
        error: "INVALID_PROMPT",
        message: "Escreva o que você deseja receber ou selecione seus interesses para calibrar o algoritmo."
      });
    }

    const categoriesToSave = Array.isArray(selectedCategories) && selectedCategories.length > 0
      ? selectedCategories
      : ['shitpost', 'tecnologia'];

    const updated = await reelsModel.saveUserPreferences(userId, categoriesToSave, customPrompt ? customPrompt.trim() : '');

    return res.status(200).json({
      success: true,
      message: "Algoritmo calibrado com sucesso com as suas preferências!",
      preferences: updated
    });
  } catch (error) {
    next(error);
  }
}

async function getFeed(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));

    let excludeIds = [];
    if (req.query.excludeIds) {
      if (Array.isArray(req.query.excludeIds)) {
        excludeIds = req.query.excludeIds;
      } else if (typeof req.query.excludeIds === 'string') {
        excludeIds = req.query.excludeIds.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const resetSeen = req.query.reset === 'true' || req.query.reset === true;

    const feedData = await reelsService.getPersonalizedReelsFeed(userId, limit, excludeIds, resetSeen);

    return res.status(200).json({
      success: true,
      ...feedData
    });
  } catch (error) {
    next(error);
  }
}

async function toggleLike(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    const { videoId } = req.params;
    const { category } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "INVALID_VIDEO_ID", message: "ID do vídeo é obrigatório." });
    }

    const result = await reelsModel.toggleReelLike(userId, videoId, category);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function moreLikeThis(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    const { videoId } = req.params;
    const { category } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "INVALID_VIDEO_ID", message: "ID do vídeo é obrigatório." });
    }

    await reelsModel.recordInteraction(userId, videoId, category, 'MORE_LIKE_THIS');

    return res.status(200).json({
      success: true,
      message: "Algoritmo calibrado: mais conteúdos como este serão recomendados!"
    });
  } catch (error) {
    next(error);
  }
}

async function notInterested(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Usuário não autenticado." });
    }

    const { videoId } = req.params;
    const { category } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "INVALID_VIDEO_ID", message: "ID do vídeo é obrigatório." });
    }

    await reelsModel.recordInteraction(userId, videoId, category, 'NOT_INTERESTED');

    return res.status(200).json({
      success: true,
      message: "Vídeo ocultado com sucesso. Menos conteúdos deste tipo serão exibidos."
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCategories,
  getPreferences,
  savePreferences,
  getFeed,
  toggleLike,
  moreLikeThis,
  notInterested
};
