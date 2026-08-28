const { uploadToR2 } = require("../services/cloudflare");
const { validateFileMagicBytes } = require("../utils/fileValidation");

async function uploadFile(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }

    const validation = validateFileMagicBytes(req.file.buffer, "any");
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }

    const validation = validateFileMagicBytes(req.file.buffer, "image");
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype || "image/jpeg",
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }

    const validation = validateFileMagicBytes(req.file.buffer, "video");
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    const result = await uploadToR2({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype || "video/mp4",
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Arquivo de áudio não enviado" });
    }

    const validation = validateFileMagicBytes(req.file.buffer, "audio");
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
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