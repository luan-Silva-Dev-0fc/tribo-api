const { supabase, sql } = require("../config/database");
const { getBlockedUserIds } = require("./blockModel");
const { isFollowingAccepted } = require("./followModel");
const { deleteFromR2 } = require("../services/cloudflare");

function formatStoryUser(user) {
  if (!user) return null;
  const bio = user.bio && String(user.bio).trim() !== "" ? String(user.bio).trim() : null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url,
    badge_type: user.badge_type || (user.verified || user.email_verified ? 'BLUE' : 'NONE'),
    email_verified: Boolean(user.email_verified || user.verified),
    bio,
    is_private: Boolean(user.is_private)
  };
}

async function createStory({ user_id, media_url, caption }) {
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const created_at = new Date().toISOString();

  const [story] = await sql`
    INSERT INTO stories (user_id, media_url, caption, created_at, expires_at)
    VALUES (${user_id}, ${media_url}, ${caption || null}, ${created_at}, ${expires_at})
    RETURNING id, user_id, media_url, caption, created_at, expires_at
  `;

  const [user] = await sql`
    SELECT id, name, username, avatar_url, badge_type, email_verified, is_private, bio
    FROM users
    WHERE id = ${user_id}
  `;

  return {
    ...story,
    user: formatStoryUser(user)
  };
}

async function getStories(viewerId) {
  const currentUserId = viewerId;
  const blockedIds = currentUserId ? await getBlockedUserIds(currentUserId) : new Set();

  const rawStories = await sql`
    SELECT
      s.id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
      u.id as u_id, u.name as u_name, u.username as u_username,
      u.avatar_url as u_avatar_url, u.badge_type as u_badge_type,
      u.email_verified as u_email_verified, u.is_private as u_is_private, u.bio as u_bio,
      (SELECT COUNT(*) FROM story_likes WHERE story_id = s.id) as likes_count,
      EXISTS(SELECT 1 FROM story_likes WHERE story_id = s.id AND user_id = ${currentUserId}) as is_liked
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > NOW()
      AND u.status = 'ACTIVE'
      AND (
        s.user_id = ${currentUserId}
        OR s.user_id IN (
          SELECT following_id FROM follows
          WHERE follower_id = ${currentUserId} AND status = 'ACCEPTED'
        )
      )
    ORDER BY s.created_at DESC
  `;

  return rawStories.
  filter((row) => !blockedIds.has(row.user_id)).
  map((row) => ({
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    caption: row.caption,
    created_at: row.created_at,
    expires_at: row.expires_at,
    likes_count: Number(row.likes_count) || 0,
    is_liked: Boolean(row.is_liked),
    user: formatStoryUser({
      id: row.u_id,
      name: row.u_name,
      username: row.u_username,
      avatar_url: row.u_avatar_url,
      badge_type: row.u_badge_type,
      email_verified: row.u_email_verified,
      is_private: row.u_is_private,
      bio: row.u_bio
    })
  }));
}

const getFeedStories = getStories;

async function getUserStories(targetUserId, viewerId) {
  const blockedIds = viewerId ? await getBlockedUserIds(viewerId) : new Set();

  if (blockedIds.has(targetUserId)) {
    return [];
  }

  const [targetUser] = await sql`
    SELECT id, name, username, avatar_url, badge_type, email_verified, is_private, bio, status
    FROM users
    WHERE id = ${targetUserId}
  `;

  if (!targetUser || targetUser.status !== 'ACTIVE') {
    return [];
  }

  if (targetUser.is_private && viewerId !== targetUserId) {
    const isFollowing = await isFollowingAccepted(viewerId, targetUserId);
    if (!isFollowing) {
      return [];
    }
  }

  const rawStories = await sql`
    SELECT
      id, user_id, media_url, caption, created_at, expires_at,
      (SELECT COUNT(*) FROM story_likes WHERE story_id = id) as likes_count,
      EXISTS(SELECT 1 FROM story_likes WHERE story_id = id AND user_id = ${viewerId}) as is_liked
    FROM stories
    WHERE user_id = ${targetUserId}
      AND expires_at > NOW()
    ORDER BY created_at ASC
  `;

  const userFormatted = formatStoryUser(targetUser);

  return rawStories.map((story) => ({
    ...story,
    likes_count: Number(story.likes_count) || 0,
    is_liked: Boolean(story.is_liked),
    user: userFormatted
  }));
}

async function getStoryById(id) {
  const [row] = await sql`
    SELECT
      s.id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
      u.id as u_id, u.name as u_name, u.username as u_username,
      u.avatar_url as u_avatar_url, u.badge_type as u_badge_type,
      u.email_verified as u_email_verified, u.is_private as u_is_private, u.bio as u_bio
    FROM stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${id}
  `;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    caption: row.caption,
    created_at: row.created_at,
    expires_at: row.expires_at,
    is_expired: new Date(row.expires_at) <= new Date(),
    user: formatStoryUser({
      id: row.u_id,
      name: row.u_name,
      username: row.u_username,
      avatar_url: row.u_avatar_url,
      badge_type: row.u_badge_type,
      email_verified: row.u_email_verified,
      is_private: row.u_is_private,
      bio: row.u_bio
    })
  };
}

async function updateStoryCaption(id, caption, userId) {
  const [existing] = await sql`
    SELECT id, user_id FROM stories WHERE id = ${id}
  `;

  if (!existing) {
    const error = new Error("Story não encontrado");
    error.status = 404;
    throw error;
  }

  if (existing.user_id !== userId) {
    const error = new Error("Sem permissão para editar este story");
    error.status = 403;
    throw error;
  }

  const [updated] = await sql`
    UPDATE stories
    SET caption = ${caption || null}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, user_id, media_url, caption, created_at, expires_at
  `;

  return updated;
}

async function deleteStory(id, userId) {
  const [story] = await sql`
    SELECT id, user_id, media_url
    FROM stories
    WHERE id = ${id}
  `;

  if (!story) {
    const error = new Error("Story não encontrado");
    error.status = 404;
    throw error;
  }

  if (story.user_id !== userId) {
    const error = new Error("Sem permissão para deletar este story");
    error.status = 403;
    throw error;
  }

  await sql`DELETE FROM stories WHERE id = ${id}`;

  if (story.media_url) {
    await deleteFromR2(story.media_url);
  }

  return true;
}

async function likeStory(storyId, userId) {
  await sql`
    INSERT INTO story_likes (story_id, user_id)
    VALUES (${storyId}, ${userId})
    ON CONFLICT DO NOTHING
  `;
}

async function unlikeStory(storyId, userId) {
  await sql`
    DELETE FROM story_likes
    WHERE story_id = ${storyId} AND user_id = ${userId}
  `;
}

module.exports = {
  createStory,
  getStories,
  getFeedStories,
  getUserStories,
  getStoryById,
  updateStoryCaption,
  deleteStory,
  likeStory,
  unlikeStory
};