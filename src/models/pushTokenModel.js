const { sql } = require('../config/database');

async function savePushToken({ userId, token, deviceType = 'mobile' }) {
  if (!userId || !token) {
    throw new Error('userId e token são obrigatórios');
  }

  const [saved] = await sql`
    INSERT INTO user_push_tokens (user_id, token, device_type, updated_at)
    VALUES (${userId}, ${token}, ${deviceType || 'mobile'}, NOW())
    ON CONFLICT (user_id, token)
    DO UPDATE SET
      device_type = COALESCE(EXCLUDED.device_type, user_push_tokens.device_type),
      updated_at = NOW()
    RETURNING id, user_id, token, device_type, created_at, updated_at
  `;

  return saved;
}

async function getUserTokens(userId) {
  if (!userId) return [];
  const rows = await sql`
    SELECT token, device_type, updated_at
    FROM user_push_tokens
    WHERE user_id = ${userId}
  `;
  return rows.map((r) => r.token);
}

async function getUsersTokens(userIds = []) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const rows = await sql`
    SELECT user_id, token, device_type
    FROM user_push_tokens
    WHERE user_id = ANY(${userIds}::uuid[])
  `;
  return rows;
}

async function removePushToken(userId, token) {
  if (!userId || !token) return;
  await sql`
    DELETE FROM user_push_tokens
    WHERE user_id = ${userId} AND token = ${token}
  `;
}

async function deleteInvalidTokens(tokens = []) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;
  await sql`
    DELETE FROM user_push_tokens
    WHERE token = ANY(${tokens}::text[])
  `;
}

module.exports = {
  savePushToken,
  getUserTokens,
  getUsersTokens,
  removePushToken,
  deleteInvalidTokens
};