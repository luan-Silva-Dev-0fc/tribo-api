const stickerModel = require('../models/stickerModel');

async function createVideoSticker(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { video_url, media_url, sticker_name, pack_name, author_name, description } = req.body;

    const videoUrl = video_url || media_url || req.file?.location || req.file?.path;
    if (!videoUrl) {
      return res.status(400).json({ success: false, message: 'URL do vídeo é obrigatória.' });
    }

    const sticker = await stickerModel.createSticker({
      userId,
      videoUrl,
      mediaUrl: media_url || videoUrl,
      stickerName: sticker_name,
      packName: pack_name,
      authorName: author_name || req.user?.name || req.user?.username,
      description
    });

    if (userId) {
      await stickerModel.favoriteSticker(userId, {
        sticker_id: sticker.id,
        video_url: sticker.video_url,
        media_url: sticker.media_url,
        sticker_name: sticker.sticker_name,
        pack_name: sticker.pack_name,
        author_name: sticker.author_name,
        description: sticker.description
      });
    }

    return res.status(201).json({ success: true, sticker });
  } catch (err) {
    next(err);
  }
}

async function getSticker(req, res, next) {
  try {
    const { id } = req.params;
    const sticker = await stickerModel.getStickerById(id);
    if (!sticker) {
      return res.status(404).json({ success: false, message: 'Figurinha não encontrada.' });
    }
    return res.status(200).json({ success: true, sticker });
  } catch (err) {
    next(err);
  }
}

async function favoriteSticker(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;
    const stickerData = {
      ...(req.body || {}),
      sticker_id: id
    };

    const fav = await stickerModel.favoriteSticker(userId, stickerData);
    return res.status(200).json({ success: true, favorite: fav });
  } catch (err) {
    next(err);
  }
}

async function unfavoriteSticker(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { id } = req.params;

    await stickerModel.unfavoriteSticker(userId, id);
    return res.status(200).json({ success: true, message: 'Figurinha removida dos favoritos com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function listMyInventory(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const { pack } = req.query;

    const stickers = await stickerModel.listUserInventory(userId, pack);
    return res.status(200).json({ success: true, stickers });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createVideoSticker,
  getSticker,
  favoriteSticker,
  unfavoriteSticker,
  listMyInventory
};