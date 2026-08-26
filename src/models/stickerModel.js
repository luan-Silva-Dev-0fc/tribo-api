const { sql } = require('../config/database');

async function createSticker({ userId, videoUrl, mediaUrl, stickerName, packName, authorName, description }) {
  const [sticker] = await sql`
    INSERT INTO stickers (user_id, video_url, media_url, sticker_name, pack_name, author_name, description)
    VALUES (
      ${userId || null},
      ${videoUrl},
      ${mediaUrl || videoUrl},
      ${stickerName || 'Figurinha de Vídeo'},
      ${packName || 'Gerais'},
      ${authorName || 'Tribo'},
      ${description || null}
    )
    RETURNING *;
  `;
  return sticker;
}

async function getStickerById(id) {
  const [sticker] = await sql`
    SELECT * FROM stickers WHERE id::text = ${String(id)} LIMIT 1;
  `;
  return sticker;
}

async function favoriteSticker(userId, stickerData) {
  const stickerId = String(stickerData.sticker_id || stickerData.id || stickerData.stickerId || 'stk_' + Date.now());
  const videoUrl = stickerData.video_url || stickerData.videoUrl || stickerData.media_url || stickerData.url;
  const mediaUrl = stickerData.media_url || videoUrl;
  const stickerName = stickerData.sticker_name || stickerData.stickerName || stickerData.name || 'Figurinha de Vídeo';
  const packName = stickerData.pack_name || stickerData.packName || 'Gerais';
  const authorName = stickerData.author_name || stickerData.authorName || 'Tribo';
  const description = stickerData.description || null;

  const [fav] = await sql`
    INSERT INTO sticker_favorites (
      user_id, sticker_id, video_url, media_url, sticker_name, pack_name, author_name, description
    )
    VALUES (
      ${userId}, ${stickerId}, ${videoUrl}, ${mediaUrl}, ${stickerName}, ${packName}, ${authorName}, ${description}
    )
    ON CONFLICT (user_id, sticker_id)
    DO UPDATE SET
      video_url = EXCLUDED.video_url,
      media_url = EXCLUDED.media_url,
      sticker_name = EXCLUDED.sticker_name,
      pack_name = EXCLUDED.pack_name,
      author_name = EXCLUDED.author_name,
      description = EXCLUDED.description,
      created_at = NOW()
    RETURNING *;
  `;
  return fav;
}

async function unfavoriteSticker(userId, stickerId) {
  await sql`
    DELETE FROM sticker_favorites
    WHERE user_id = ${userId} AND (sticker_id = ${String(stickerId)} OR id::text = ${String(stickerId)});
  `;
  return true;
}

async function listUserInventory(userId, packName = null) {
  if (packName && packName !== 'Todos') {
    return await sql`
      SELECT
        id, sticker_id, video_url, media_url, sticker_name, pack_name, author_name, description, created_at
      FROM sticker_favorites
      WHERE user_id = ${userId} AND LOWER(pack_name) = LOWER(${packName})
      ORDER BY created_at DESC;
    `;
  }

  return await sql`
    SELECT
      id, sticker_id, video_url, media_url, sticker_name, pack_name, author_name, description, created_at
    FROM sticker_favorites
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;
}

module.exports = {
  createSticker,
  getStickerById,
  favoriteSticker,
  unfavoriteSticker,
  listUserInventory
};