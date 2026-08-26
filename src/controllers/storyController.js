const storyModel = require("../models/storyModel");
const messageModel = require("../models/messageModel");
const { uploadToR2 } = require("../services/cloudflare");

async function createStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    let mediaUrl = req.body.media_url;

    if (req.file) {
      const uploadRes = await uploadToR2({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        folder: "stories"
      });
      mediaUrl = uploadRes.url;
    }

    if (!mediaUrl) {
      return res.status(400).json({ message: "Arquivo de mídia ou media_url é obrigatório" });
    }

    const story = await storyModel.createStory({
      user_id: currentUserId,
      media_url: mediaUrl,
      caption: req.body.caption
    });

    return res.status(201).json({
      message: "Story criado com sucesso",
      story
    });
  } catch (error) {
    next(error);
  }
}

async function getStories(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    const stories = await storyModel.getStories(currentUserId);
    return res.status(200).json(stories);
  } catch (error) {
    next(error);
  }
}

const getFeedStories = getStories;

async function getUserStories(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    const stories = await storyModel.getUserStories(req.params.id, currentUserId);
    return res.status(200).json(stories);
  } catch (error) {
    next(error);
  }
}

async function getStoryById(req, res, next) {
  try {
    const story = await storyModel.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: "Story não encontrado" });
    }
    return res.status(200).json(story);
  } catch (error) {
    next(error);
  }
}

async function updateStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    const updated = await storyModel.updateStoryCaption(
      req.params.id,
      req.body.caption,
      currentUserId
    );

    return res.status(200).json({
      message: "Legenda atualizada com sucesso",
      story: updated
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
}

async function deleteStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    await storyModel.deleteStory(req.params.id, currentUserId);
    return res.status(200).json({ message: "Story deletado com sucesso" });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
}

async function sendStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    const receiver_id = req.body.receiver_id || req.body.userId;
    if (!receiver_id) {
      return res.status(400).json({ message: "Destinatário é obrigatório (receiver_id)" });
    }

    const story = await storyModel.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ message: "Story não encontrado" });
    }

    if (story.is_expired) {
      return res.status(400).json({ message: "Este story já expirou e não pode ser compartilhado" });
    }

    const message = await messageModel.createDirectMessage({
      sender_id: currentUserId,
      receiver_id,
      content: req.body.content || "Compartilhou um story",
      story_id: story.id,
      media_url: story.media_url
    });

    return res.status(201).json({
      message: "Story enviado com sucesso",
      direct_message: {
        ...message,
        story
      }
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function likeStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    await storyModel.likeStory(req.params.id, currentUserId);
    return res.status(200).json({ message: "Story curtido com sucesso" });
  } catch (error) {
    next(error);
  }
}

async function unlikeStory(req, res, next) {
  try {
    const currentUserId = req.user.id || req.user.sub;
    await storyModel.unlikeStory(req.params.id, currentUserId);
    return res.status(200).json({ message: "Story descurtido com sucesso" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createStory,
  getStories,
  getFeedStories,
  getUserStories,
  getStoryById,
  updateStory,
  deleteStory,
  sendStory,
  likeStory,
  unlikeStory
};