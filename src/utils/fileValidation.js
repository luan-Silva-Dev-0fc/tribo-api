/**
 * Validador de Assinatura Real de Arquivos (Magic Bytes / File Header Sniffing)
 * Protege a API contra upload de scripts maliciosos ou executáveis disfarçados de imagem/vídeo.
 */

function validateFileMagicBytes(buffer, expectedType = 'any') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { valid: false, reason: 'Arquivo inválido ou corrompido' };
  }

  // 1. Detecção e bloqueio preventivo de executáveis e scripts maliciosos
  // MZ (Windows EXE / DLL)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { valid: false, reason: 'Arquivos executáveis (.exe/.dll) são estritamente proibidos' };
  }
  // ELF (Linux Executable)
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return { valid: false, reason: 'Binários executáveis são proibidos' };
  }
  // Scripts PHP / HTML / JS camuflados
  const headerUtf8 = buffer.slice(0, 64).toString('utf8').toLowerCase();
  if (
    headerUtf8.includes('<?php') ||
    headerUtf8.includes('<script') ||
    headerUtf8.includes('eval(') ||
    headerUtf8.includes('base64_decode')
  ) {
    return { valid: false, reason: 'Código de script malicioso detectado no cabeçalho do arquivo' };
  }

  // 2. Assinaturas de Imagens
  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  const isWebp = buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50; // WEBP

  const isImage = isJpeg || isPng || isGif || isWebp;

  // 3. Assinaturas de Vídeos
  // MP4 / MOV / M4V (ftyp box at offset 4)
  const isMp4 = buffer.length >= 8 &&
    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
  // WebM / MKV (EBML: 1A 45 DF A3)
  const isWebm = buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3;
  // AVI (RIFF ... AVI )
  const isAvi = buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && buffer[11] === 0x20;

  const isVideo = isMp4 || isWebm || isAvi;

  // 4. Assinaturas de Áudio
  // MP3: ID3 tag (49 44 33) ou sync bytes (FF FB / FF F3 / FF F2)
  const isMp3 = (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
    (buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2));
  // OGG: OggS (4F 67 67 53)
  const isOgg = buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53;
  // WAV: RIFF ... WAVE
  const isWav = buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45;
  // M4A / AAC: ftyp ou AAC ADTS
  const isM4a = isMp4 || (buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0);

  const isAudio = isMp3 || isOgg || isWav || isM4a;

  if (expectedType === 'image') {
    if (!isImage) return { valid: false, reason: 'O arquivo enviado não possui uma assinatura de imagem válida (JPEG, PNG, GIF, WebP).' };
    return { valid: true, detectedType: 'image' };
  }

  if (expectedType === 'video') {
    if (!isVideo) return { valid: false, reason: 'O arquivo enviado não possui uma assinatura de vídeo válida (MP4, WebM, MOV, AVI).' };
    return { valid: true, detectedType: 'video' };
  }

  if (expectedType === 'audio') {
    if (!isAudio) return { valid: false, reason: 'O arquivo enviado não possui uma assinatura de áudio válida (M4A, MP3, OGG, WAV).' };
    return { valid: true, detectedType: 'audio' };
  }

  if (isImage || isVideo || isAudio) {
    return { valid: true, detectedType: isImage ? 'image' : isVideo ? 'video' : 'audio' };
  }

  return { valid: false, reason: 'Tipo de mídia não suportado ou formato desconhecido.' };
}

module.exports = { validateFileMagicBytes };
