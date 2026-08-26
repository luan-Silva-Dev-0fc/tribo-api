const { supabase, sql } = require('../config/database');

async function createBlock(payload) {
  const [data] = await sql`
    INSERT INTO blocks (blocker_id, blocked_id)
    VALUES (${payload.blocker_id}, ${payload.blocked_id})
    RETURNING *
  `;
  return data;
}

async function getBlocksByUser(blockerId) {
  return sql`
    SELECT * FROM blocks
    WHERE blocker_id = ${blockerId}
    ORDER BY created_at DESC
  `;
}

async function findBlock(blockerId, blockedId) {
  const [data] = await sql`
    SELECT * FROM blocks
    WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
    LIMIT 1
  `;
  return data || null;
}

async function deleteBlock(id) {
  await sql`DELETE FROM blocks WHERE id = ${id}`;
}

async function getBlockedUserIds(userId) {
  if (!userId) return new Set();
  const rows = await sql`
    SELECT blocker_id, blocked_id
    FROM blocks
    WHERE blocker_id = ${userId} OR blocked_id = ${userId}
  `;
  const blockedIds = new Set();
  for (const block of rows) {
    if (block.blocker_id === userId) {
      blockedIds.add(block.blocked_id);
    } else if (block.blocked_id === userId) {
      blockedIds.add(block.blocker_id);
    }
  }
  return blockedIds;
}

module.exports = { createBlock, getBlocksByUser, findBlock, deleteBlock, getBlockedUserIds };