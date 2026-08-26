const { uploadToR2 } = require("../services/cloudflare");

async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: "uploads"
    });

    return res.status(201).json({
      success: true,
      message: "Upload realizado com sucesso",
      url: result.url,
      media_url: result.url,
      data: { url: result.url },
      file: result
    });
  } catch (error) {
    next(error);
  }
}

async function uploadPhoto(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Envie uma imagem válida" });
    }

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: "photos"
    });

    return res.status(201).json({
      success: true,
      message: "Foto enviada com sucesso",
      url: result.url,
      media_url: result.url,
      data: { url: result.url },
      file: result
    });
  } catch (error) {
    next(error);
  }
}

async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }
    if (!req.file.mimetype.startsWith("video/")) {
      return res.status(400).json({ message: "Envie um vídeo válido" });
    }

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: "videos"
    });

    return res.status(201).json({
      success: true,
      message: "Vídeo enviado com sucesso",
      url: result.url,
      media_url: result.url,
      data: { url: result.url },
      file: result
    });
  } catch (error) {
    next(error);
  }
}

async function uploadAudio(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo de áudio não enviado" });
    }

    const mime = (req.file.mimetype || "").toLowerCase();
    const originalName = (req.file.originalname || "").toLowerCase();
    const isAudio =
    !mime ||
    mime === "application/octet-stream" ||
    mime.startsWith("audio/") ||
    mime.includes("ogg") ||
    mime.includes("mp4") ||
    mime.includes("m4a") ||
    mime.includes("aac") ||
    mime.includes("wav") ||
    mime.includes("webm") ||
    /\.(mp3|m4a|aac|ogg|wav|webm|flac|oga|opus)$/i.test(originalName);

    if (!isAudio) {
      return res.status(400).json({ message: "Envie um arquivo de áudio válido (.m4a, .mp3, .aac, .ogg, .wav)" });
    }

    const fileName = req.file.originalname || `audio_${Date.now()}.m4a`;
    const contentType = req.file.mimetype && req.file.mimetype !== "application/octet-stream" ? req.file.mimetype : "audio/m4a";

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName,
      contentType,
      folder: "audios"
    });

    return res.status(201).json({
      success: true,
      message: "Áudio enviado com sucesso",
      url: result.url,
      media_url: result.url,
      data: { url: result.url },
      file: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadFile, uploadPhoto, uploadVideo, uploadAudio };