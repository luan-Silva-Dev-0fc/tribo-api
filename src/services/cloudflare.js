const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
  },
});

async function uploadToR2({ buffer, fileName, contentType, folder = 'uploads' }) {
  const key = `${folder}/${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await client.send(command);
  } catch (err) {
    console.error('[R2 Upload Error] Name:', err.name);
    console.error('[R2 Upload Error] Message:', err.message);
    console.error('[R2 Upload Error] Code:', err.Code || err.$metadata?.httpStatusCode);
    console.error('[R2 Upload Error] Full:', JSON.stringify(err.$metadata || {}, null, 2));
    throw err;
  }

  const baseUrl = (env.R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev').replace(/\/$/, '');
  const publicUrl = `${baseUrl}/${key}`;

  return { key, url: publicUrl };
}

async function deleteFromR2(keyOrUrl) {
  if (!keyOrUrl) return;
  let key = keyOrUrl;
  if (typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://'))) {
    try {
      const urlObj = new URL(key);
      key = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
    } catch (e) {
    }
  }

  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
  });

  try {
    await client.send(command);
  } catch (err) {
    console.warn('[R2 Delete Warning] Failed to delete object:', key, err.message);
  }
}

module.exports = { uploadToR2, deleteFromR2 };
