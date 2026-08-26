const { sql } = require('../config/database');

const CDN_URL = "https://pub-08d4ac7de5354fadbfe07fcbc70237ba.r2.dev/";

const AVAILABLE_CATEGORIES = [
{
  id: 'shitpost',
  label: 'Shitposts & Memes',
  iconUrl: `${CDN_URL}shitpost.png`,
  query: 'memes brasil 2026 shorts',
  queries: [
    'memes brasil 2026 shorts',
    'shitpost 2026 brasil shorts',
    'memes virais 2026 shorts',
    'humor brasil 2026 engraçado shorts',
    'memes do momento 2026 shorts'
  ]
},
{
  id: 'tecnologia',
  label: 'Tecnologia & Programação',
  iconUrl: `${CDN_URL}tecnologia.png`,
  query: 'tecnologia programacao 2026 shorts',
  queries: [
    'tecnologia programacao 2026 shorts',
    'inteligencia artificial 2026 shorts',
    'tech dev 2026 dicas shorts',
    'gadgets lancamentos 2026 shorts'
  ]
},
{
  id: 'musica',
  label: 'Música & Clips',
  iconUrl: `${CDN_URL}musica.png`,
  query: 'musica lancamento 2026 brasil shorts',
  queries: [
    'musica lancamento 2026 brasil shorts',
    'trap funk 2026 brasil shorts',
    'hits virais 2026 musicas shorts',
    'clipe musica 2026 shorts'
  ]
},
{
  id: 'jogos',
  label: 'Jogos & Gaming',
  iconUrl: `${CDN_URL}jogos.png`,
  query: 'jogos lancamentos 2026 shorts brasil',
  queries: [
    'jogos lancamentos 2026 shorts brasil',
    'gaming gameplay 2026 shorts brasil',
    'momentos games 2026 clips shorts',
    'gta 6 jogos 2026 shorts'
  ]
},
{
  id: 'carros',
  label: 'Carros & Automóveis',
  iconUrl: `${CDN_URL}carros.png`,
  query: 'carros automoveis 2026 shorts',
  queries: [
    'carros automoveis 2026 shorts',
    'superesportivos acelerando 2026 shorts',
    'projetos carros 2026 brasil shorts'
  ]
},
{
  id: 'esportes',
  label: 'Futebol & Esportes',
  iconUrl: `${CDN_URL}esportes.png`,
  query: 'futebol 2026 gols melhores momentos shorts',
  queries: [
    'futebol 2026 gols melhores momentos shorts',
    'dribles futebol 2026 shorts brasil',
    'futebol lances incriveis 2026 shorts'
  ]
},
{
  id: 'filmes_animes',
  label: 'Filmes & Animes',
  iconUrl: `${CDN_URL}filmes_animes.png`,
  query: 'animes cenas epicas 2026 shorts',
  queries: [
    'animes cenas epicas 2026 shorts',
    'filmes series lancamentos 2026 shorts',
    'anime edit 2026 shorts brasil'
  ]
},
{
  id: 'curiosidades',
  label: 'Curiosidades & Fatos',
  iconUrl: `${CDN_URL}curiosidades.png`,
  query: 'curiosidades fatos surpreendentes 2026 shorts',
  queries: [
    'curiosidades fatos surpreendentes 2026 shorts',
    'voce sabia 2026 fatos incriveis shorts',
    'ciencia curiosidades 2026 shorts'
  ]
},
{
  id: 'lutas',
  label: 'Lutas & Artes Marciais',
  iconUrl: `${CDN_URL}lutas.png`,
  query: 'ufc mma nocaute 2026 shorts',
  queries: [
    'ufc mma nocaute 2026 shorts',
    'lutas melhores momentos 2026 shorts',
    'boxe artes marciais 2026 shorts'
  ]
}];

const VALID_CATEGORY_IDS = new Set(AVAILABLE_CATEGORIES.map((c) => c.id));

function getAvailableCategories() {
  return AVAILABLE_CATEGORIES;
}

const isValidUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function getUserPreferences(userId) {
  if (!userId || !isValidUUID(userId)) return null;

  const [row] = await sql`
    SELECT user_id, selected_categories, category_scores, custom_prompt, onboarding_completed, created_at, updated_at
    FROM user_reel_preferences
    WHERE user_id = ${userId};
  `;

  if (!row) {
    return {
      userId,
      onboardingCompleted: false,
      selectedCategories: [],
      categoryScores: {}
    };
  }

  return {
    userId: row.user_id,
    onboardingCompleted: Boolean(row.onboarding_completed),
    selectedCategories: row.selected_categories || [],
    categoryScores: row.category_scores || {},
    customPrompt: row.custom_prompt || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function saveUserPreferences(userId, selectedCategories = [], customPrompt = '') {
  if (!userId || !isValidUUID(userId)) throw new Error("ID do usuário é obrigatório e deve ser um UUID válido.");

  const cleanCategories = selectedCategories.filter((cat) => VALID_CATEGORY_IDS.has(cat));

  const current = await getUserPreferences(userId) || {};
  const scores = { ...(current.categoryScores || {}) };

  cleanCategories.forEach((cat) => {
    if (scores[cat] === undefined || scores[cat] < 5) {
      scores[cat] = 10;
    }
  });

  const now = new Date().toISOString();

  const [saved] = await sql`
    INSERT INTO user_reel_preferences (
      user_id, selected_categories, category_scores, custom_prompt, onboarding_completed, created_at, updated_at
    )
    VALUES (
      ${userId},
      ${sql.array(cleanCategories)},
      ${sql.json(scores)},
      ${customPrompt || null},
      true,
      ${now},
      ${now}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      selected_categories = EXCLUDED.selected_categories,
      category_scores = EXCLUDED.category_scores,
      custom_prompt = EXCLUDED.custom_prompt,
      onboarding_completed = true,
      updated_at = EXCLUDED.updated_at
    RETURNING user_id, selected_categories, category_scores, custom_prompt, onboarding_completed, updated_at;
  `;

  return {
    userId: saved.user_id,
    onboardingCompleted: Boolean(saved.onboarding_completed),
    selectedCategories: saved.selected_categories || [],
    categoryScores: saved.category_scores || {},
    updatedAt: saved.updated_at
  };
}

async function adjustCategoryScore(userId, category, delta) {
  if (!userId || !isValidUUID(userId) || !category || !VALID_CATEGORY_IDS.has(category)) return;

  const current = await getUserPreferences(userId) || {};
  const scores = { ...(current.categoryScores || {}) };

  const currentScore = scores[category] !== undefined ? scores[category] : 5;

  const newScore = Math.max(0, Math.min(100, currentScore + delta));
  scores[category] = newScore;

  await sql`
    INSERT INTO user_reel_preferences (user_id, category_scores, updated_at)
    VALUES (${userId}, ${sql.json(scores)}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      category_scores = EXCLUDED.category_scores,
      updated_at = NOW();
  `;
}

async function recordInteraction(userId, videoId, category, action) {
  if (!userId || !isValidUUID(userId) || !videoId || !action) return;

  await sql`
    INSERT INTO user_reel_interactions (user_id, video_id, category, action, created_at)
    VALUES (${userId}, ${videoId}, ${category || null}, ${action}, NOW());
  `;

  if (category && VALID_CATEGORY_IDS.has(category)) {
    if (action === 'LIKE') {
      await adjustCategoryScore(userId, category, +3);
    } else if (action === 'UNLIKE') {
      await adjustCategoryScore(userId, category, -3);
    } else if (action === 'MORE_LIKE_THIS') {
      await adjustCategoryScore(userId, category, +5);
    } else if (action === 'NOT_INTERESTED') {
      await adjustCategoryScore(userId, category, -5);
    }
  }
}

async function toggleReelLike(userId, videoId, category) {
  if (!userId || !isValidUUID(userId) || !videoId) throw new Error("Parâmetros inválidos.");

  const [existing] = await sql`
    SELECT user_id, video_id FROM reel_likes
    WHERE user_id = ${userId} AND video_id = ${videoId};
  `;

  let isLiked = false;

  if (existing) {
    await sql`
      DELETE FROM reel_likes
      WHERE user_id = ${userId} AND video_id = ${videoId};
    `;
    await recordInteraction(userId, videoId, category, 'UNLIKE');
    isLiked = false;
  } else {
    await sql`
      INSERT INTO reel_likes (user_id, video_id, category, created_at)
      VALUES (${userId}, ${videoId}, ${category || null}, NOW())
      ON CONFLICT (user_id, video_id) DO NOTHING;
    `;
    await recordInteraction(userId, videoId, category, 'LIKE');
    isLiked = true;
  }

  const [countRow] = await sql`
    SELECT COUNT(*)::int as count FROM reel_likes WHERE video_id = ${videoId};
  `;

  return {
    videoId,
    isLiked,
    likesCount: countRow ? countRow.count : isLiked ? 1 : 0
  };
}

async function getUserBlockedVideoIds(userId) {
  if (!userId || !isValidUUID(userId)) return new Set();

  const rows = await sql`
    SELECT video_id FROM user_reel_interactions
    WHERE user_id = ${userId} AND action = 'NOT_INTERESTED';
  `;

  return new Set(rows.map((r) => r.video_id));
}

async function getUserLikedVideoIds(userId, videoIds = []) {
  if (!userId || !isValidUUID(userId) || videoIds.length === 0) return new Set();

  const rows = await sql`
    SELECT video_id FROM reel_likes
    WHERE user_id = ${userId} AND video_id IN ${sql(videoIds)};
  `;

  return new Set(rows.map((r) => r.video_id));
}

async function getReelLikesCountMap(videoIds = []) {
  if (videoIds.length === 0) return {};

  const rows = await sql`
    SELECT video_id, COUNT(*)::int as count
    FROM reel_likes
    WHERE video_id IN ${sql(videoIds)}
    GROUP BY video_id;
  `;

  const map = {};
  rows.forEach((r) => {
    map[r.video_id] = r.count;
  });
  return map;
}

module.exports = {
  AVAILABLE_CATEGORIES,
  VALID_CATEGORY_IDS,
  getAvailableCategories,
  getUserPreferences,
  saveUserPreferences,
  adjustCategoryScore,
  recordInteraction,
  toggleReelLike,
  getUserBlockedVideoIds,
  getUserLikedVideoIds,
  getReelLikesCountMap
};