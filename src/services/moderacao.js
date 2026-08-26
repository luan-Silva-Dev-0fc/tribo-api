const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { execFile } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

if (ffmpegInstaller && ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}
if (ffprobeInstaller && ffprobeInstaller.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

function isVideoMedia(input) {
  if (!input) return false;
  if (typeof input === 'object') {
    if (input.mimetype && input.mimetype.startsWith('video/')) return true;
    if (input.type === 'video') return true;
    const name = input.originalname || input.filename || input.name || input.url || input.uri || input.path || '';
    if (/\.(mp4|mov|webm|avi|mkv|m4v|3gp|flv|wmv)(\?.*)?$/i.test(name)) return true;
  }
  if (typeof input === 'string') {
    if (/\.(mp4|mov|webm|avi|mkv|m4v|3gp|flv|wmv)(\?.*)?$/i.test(input)) return true;
    if (input.includes('/videos/') || input.includes('video_')) return true;
  }
  return false;
}

const checkStrictImageModeration = async (file) => {
  try {
    if (!file) return { aprovado: true, isNSFW: false };

    const data = new FormData();

    if (file.buffer) {
      data.append('media', file.buffer, { filename: file.originalname || 'upload.jpg' });
    } else if (Buffer.isBuffer(file)) {
      data.append('media', file, { filename: 'upload.jpg' });
    } else if (file.path && fs.existsSync(file.path)) {
      data.append('media', fs.createReadStream(file.path));
    } else if (typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'))) {
      data.append('url', file);
    } else if (typeof file === 'string' && fs.existsSync(file)) {
      data.append('media', fs.createReadStream(file));
    } else {
      console.warn('[MODERAÇÃO] Formato de imagem não suportado ou URI local, pulando verificação direta.');
      return { aprovado: true, isNSFW: false };
    }

    data.append('models', 'nudity-2.1,gore-2.0');
    data.append('api_user', process.env.SIGHTENGINE_API_USER);
    data.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

    const response = await axios.post('https://api.sightengine.com/1.0/check.json', data, {
      headers: data.getHeaders(),
      timeout: 10000
    });

    const resData = response.data || {};
    const nudity = resData.nudity || {};
    const gore = resData.gore || {};

    if ((gore.prob || 0) > 0.60) {
      return {
        aprovado: false,
        motivo: 'VIOLENCIA_DETECTADA',
        mensagem: 'Publicação bloqueada por conter violência explícita.'
      };
    }

    const scores = {
      raw: nudity.raw || 0,
      sexual_activity: nudity.sexual_activity || 0,
      sexual_display: nudity.sexual_display || 0,
      erotica: nudity.erotica || 0,
      sextoy: nudity.sextoy || 0,
      partial: nudity.partial || 0,
      suggestive: nudity.suggestive || 0,
      safe: nudity.safe ?? 1
    };

    const isSexualOrAdult =
    scores.raw > 0.05 ||
    scores.sexual_activity > 0.05 ||
    scores.sexual_display > 0.05 ||
    scores.sextoy > 0.05 ||
    scores.erotica > 0.10 ||
    scores.partial > 0.15 ||
    scores.suggestive > 0.20 ||
    scores.safe < 0.80;

    return {
      aprovado: true,
      isNSFW: Boolean(isSexualOrAdult),
      scores
    };
  } catch (error) {
    console.error('[ERRO SIGHTENGINE IMAGEM]:', error.response?.data || error.message);
    return { aprovado: true, isNSFW: false, error: error.message };
  }
};

async function extractFramesWithFfmpeg(sourceVideoPath, tempDir) {
  const ffmpegBinary = ffmpegInstaller?.path || 'ffmpeg';
  const framePattern = path.join(tempDir, 'frame-%03d.png');

  try {
    await new Promise((resolve) => {
      execFile(
        ffmpegBinary,
        ['-y', '-i', sourceVideoPath, '-vf', 'fps=1,scale=480:-2', '-vframes', '12', framePattern],
        { timeout: 25000 },
        (error) => {
          if (error) {
            console.warn('[FFMPEG EXEC DIRECT WARNING]:', error.message);
          }
          resolve();
        }
      );
    });
  } catch (e) {
    console.warn('[FFMPEG DIRECT ERROR]:', e.message);
  }

  let frameFiles = fs.readdirSync(tempDir).filter((f) => f.startsWith('frame-'));

  if (frameFiles.length === 0) {
    try {
      await new Promise((resolve) => {
        ffmpeg(sourceVideoPath).
        on('end', resolve).
        on('error', (err) => {
          console.warn('[FLUENT-FFMPEG WARNING]:', err.message);
          resolve();
        }).
        screenshots({
          count: 10,
          folder: tempDir,
          filename: 'frame-%i.png',
          size: '480x?'
        });
      });
      frameFiles = fs.readdirSync(tempDir).filter((f) => f.startsWith('frame-'));
    } catch (e) {
      console.warn('[FLUENT-FFMPEG ERROR]:', e.message);
    }
  }

  return frameFiles;
}

const extractFramesAndModerateVideo = async (videoInput) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tribo-video-mod-'));
  let sourceVideoPath = null;

  try {

    if (typeof videoInput === 'string' && fs.existsSync(videoInput)) {
      sourceVideoPath = videoInput;
    } else if (videoInput?.path && fs.existsSync(videoInput.path)) {
      sourceVideoPath = videoInput.path;
    } else if (videoInput?.buffer || Buffer.isBuffer(videoInput)) {
      const buf = videoInput.buffer || videoInput;
      sourceVideoPath = path.join(tempDir, 'source.mp4');
      fs.writeFileSync(sourceVideoPath, buf);
    } else if (typeof videoInput === 'string' && (videoInput.startsWith('http://') || videoInput.startsWith('https://'))) {
      sourceVideoPath = path.join(tempDir, 'source.mp4');
      const response = await axios({
        method: 'get',
        url: videoInput,
        responseType: 'stream',
        timeout: 15000
      });
      const writer = fs.createWriteStream(sourceVideoPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } else if (videoInput?.url && (videoInput.url.startsWith('http://') || videoInput.url.startsWith('https://'))) {
      sourceVideoPath = path.join(tempDir, 'source.mp4');
      const response = await axios({
        method: 'get',
        url: videoInput.url,
        responseType: 'stream',
        timeout: 15000
      });
      const writer = fs.createWriteStream(sourceVideoPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } else {
      console.warn('[MODERAÇÃO VÍDEO] Origem do vídeo não reconhecida, pulando extração de frames.');
      return { aprovado: true, isNSFW: false };
    }

    const frameFiles = await extractFramesWithFfmpeg(sourceVideoPath, tempDir);
    if (frameFiles.length === 0) {
      console.warn('[MODERAÇÃO VÍDEO] Nenhum frame extraído do vídeo.');
      return { aprovado: true, isNSFW: false };
    }

    console.log(`[MODERAÇÃO VÍDEO] ${frameFiles.length} frames extraídos com sucesso para análise.`);

    let isVideoNsfw = false;
    let highestScores = {};

    for (const frame of frameFiles) {
      const framePath = path.join(tempDir, frame);
      const modResult = await checkStrictImageModeration(framePath);

      if (!modResult.aprovado) {
        return {
          aprovado: false,
          motivo: modResult.motivo,
          mensagem: modResult.mensagem
        };
      }

      if (modResult.isNSFW) {
        isVideoNsfw = true;
        highestScores = modResult.scores;
        console.log(`[MODERAÇÃO VÍDEO] Conteúdo adulto/sexual detectado no frame ${frame}:`, modResult.scores);
        break;
      }
    }

    return {
      aprovado: true,
      isNSFW: isVideoNsfw,
      scores: highestScores
    };
  } catch (error) {
    console.error('[ERRO NA MODERAÇÃO DE VÍDEO]:', error.message);
    return { aprovado: true, isNSFW: false, error: error.message };
  } finally {

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
};

const checkStrictFeedModeration = async (mediaInput) => {
  if (!mediaInput) return { aprovado: true, isNSFW: false };

  if (isVideoMedia(mediaInput)) {
    return extractFramesAndModerateVideo(mediaInput);
  }

  return checkStrictImageModeration(mediaInput);
};

const moderarMidia = checkStrictFeedModeration;

module.exports = {
  checkStrictFeedModeration,
  extractFramesAndModerateVideo,
  checkStrictImageModeration,
  moderarMidia,
  isVideoMedia
};