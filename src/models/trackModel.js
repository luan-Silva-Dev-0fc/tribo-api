const { sql, supabase } = require('../config/database');
const { logger } = require('../utils/logger');


async function ensureTracksTableExists() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tracks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL DEFAULT 'Desconhecido',
        file_url TEXT NOT NULL,
        duration REAL NOT NULL DEFAULT 0,
        cover_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tracks_title_artist ON tracks(title, artist);
    `;
  } catch (err) {
    logger.warn('Aviso ao verificar/criar tabela tracks:', err.message);
  }
}

// Executa na inicialização do módulo
ensureTracksTableExists();

/**
 * Cria uma nova música na galeria pessoal do usuário
 */
async function createTrack({ userId, title, artist, fileUrl, duration = 0, coverUrl = null }) {
  try {
    const [track] = await sql`
      INSERT INTO tracks (user_id, title, artist, file_url, duration, cover_url)
      VALUES (${userId}, ${title}, ${artist || 'Desconhecido'}, ${fileUrl}, ${duration}, ${coverUrl})
      RETURNING *;
    `;
    return track;
  } catch (err) {
    // Fallback caso use Supabase client
    const { data, error } = await supabase
      .from('tracks')
      .insert({
        user_id: userId,
        title,
        artist: artist || 'Desconhecido',
        file_url: fileUrl,
        duration,
        cover_url: coverUrl
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Lista músicas da galeria do usuário com filtro de busca (query por title ou artist)
 */
async function getUserTracks(userId, { query = '', limit = 50, offset = 0 } = {}) {
  const searchTerm = query ? `%${query.trim()}%` : null;

  try {
    if (searchTerm) {
      return await sql`
        SELECT id, user_id, title, artist, file_url, duration, cover_url, created_at, updated_at
        FROM tracks
        WHERE user_id = ${userId}
          AND (title ILIKE ${searchTerm} OR artist ILIKE ${searchTerm})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    return await sql`
      SELECT id, user_id, title, artist, file_url, duration, cover_url, created_at, updated_at
      FROM tracks
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
  } catch (err) {
    // Fallback Supabase
    let builder = supabase
      .from('tracks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (query) {
      builder = builder.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
    }

    const { data, error } = await builder;
    if (error) throw error;
    return data || [];
  }
}

/**
 * Busca música por ID
 */
async function getTrackById(id) {
  try {
    const [track] = await sql`
      SELECT t.*, u.name as user_name, u.username as user_username, u.avatar_url as user_avatar, u.badge_type as user_badge
      FROM tracks t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = ${id}
      LIMIT 1;
    `;
    return track || null;
  } catch (err) {
    const { data, error } = await supabase
      .from('tracks')
      .select('*, users:user_id(name, username, avatar_url, badge_type)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

/**
 * Remove uma música da galeria (garante que pertence ao usuário)
 */
async function deleteTrack(id, userId) {
  try {
    const [deleted] = await sql`
      DELETE FROM tracks
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id, file_url;
    `;
    return deleted || null;
  } catch (err) {
    const { data, error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}

module.exports = {
  createTrack,
  getUserTracks,
  getTrackById,
  deleteTrack,
  ensureTracksTableExists
};
