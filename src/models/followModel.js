const { supabase, sql } = require("../config/database");

function isLoyalFollower(createdAt) {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return createdDate <= oneYearAgo;
}

function formatFollowUser(user) {
  if (!user) return null;
  const bio = user.bio && String(user.bio).trim() !== "" ? String(user.bio).trim() : null;
  return {
    id: user.id,
    name: user.name,
    first_name: user.first_name || user.name || "",
    last_name: user.last_name || "",
    username: user.username,
    avatar_url: user.avatar_url,
    bio,
    is_private: Boolean(user.is_private),
    email_verified: Boolean(user.email_verified || user.verified),
    badge_type: user.badge_type || (user.verified || user.email_verified ? 'BLUE' : 'NONE')
  };
}

async function createFollow(payload) {
  const [data] = await sql`
    INSERT INTO follows (follower_id, following_id, status)
    VALUES (${payload.follower_id}, ${payload.following_id}, ${payload.status || 'ACCEPTED'})
    RETURNING *
  `;
  return data;
}

async function getAllFollows({ followerId, followingId, status } = {}) {
  let query = supabase.
  from("follows").
  select("*").
  order("created_at", { ascending: false });
  if (followerId) query = query.eq("follower_id", followerId);
  if (followingId) query = query.eq("following_id", followingId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getFollowById(id) {
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isValidUuid) return null;

  const [data] = await sql`
    SELECT * FROM follows WHERE id = ${id} LIMIT 1
  `;
  return data || null;
}

async function updateFollow(id, payload) {
  const [data] = await sql`
    UPDATE follows
    SET following_id = ${payload.following_id || null}
    WHERE id = ${id}
    RETURNING *
  `;
  return data || null;
}

async function deleteFollow(id) {
  await sql`DELETE FROM follows WHERE id = ${id}`;
}

async function findFollow(followerId, followingId) {
  const [data] = await sql`
    SELECT * FROM follows
    WHERE follower_id = ${followerId} AND following_id = ${followingId}
    LIMIT 1
  `;
  return data || null;
}

async function isFollowingAccepted(followerId, followingId) {
  if (!followerId || !followingId) return false;
  if (followerId === followingId) return true;
  const follow = await findFollow(followerId, followingId);
  return Boolean(follow && follow.status === "ACCEPTED");
}

async function getAcceptedFollowingIds(followerId) {
  if (!followerId) return new Set();
  const rows = await sql`
    SELECT following_id FROM follows
    WHERE follower_id = ${followerId} AND status = 'ACCEPTED'
  `;
  return new Set(rows.map((f) => f.following_id));
}

async function getFollowRequests(targetUserId) {
  const rows = await sql`
    SELECT
      f.id, f.follower_id, f.following_id, f.status, f.created_at,
      u.id as u_id, u.name as u_name, u.first_name as u_first_name, u.last_name as u_last_name,
      u.username as u_username, u.bio as u_bio, u.avatar_url as u_avatar_url,
      u.badge_type as u_badge_type, u.email_verified as u_email_verified, u.is_private as u_is_private
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ${targetUserId}
      AND f.status = 'PENDING'
    ORDER BY f.created_at DESC
  `;

  return rows.map((item) => ({
    id: item.id,
    follower_id: item.follower_id,
    following_id: item.following_id,
    status: item.status,
    created_at: item.created_at,
    follower: formatFollowUser({
      id: item.u_id,
      name: item.u_name,
      first_name: item.u_first_name,
      last_name: item.u_last_name,
      username: item.u_username,
      bio: item.u_bio,
      avatar_url: item.u_avatar_url,
      badge_type: item.u_badge_type,
      email_verified: item.u_email_verified,
      is_private: item.u_is_private
    })
  }));
}

async function acceptFollowRequest(requestIdOrFollowerId, targetUserId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestIdOrFollowerId);
  if (!isUuid) return null;

  const [data] = await sql`
    UPDATE follows
    SET status = 'ACCEPTED'
    WHERE following_id = ${targetUserId}
      AND (id = ${requestIdOrFollowerId} OR follower_id = ${requestIdOrFollowerId})
    RETURNING *
  `;

  return data || null;
}

async function rejectFollowRequest(requestIdOrFollowerId, targetUserId) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestIdOrFollowerId);
  if (!isUuid) return false;

  const res = await sql`
    DELETE FROM follows
    WHERE following_id = ${targetUserId}
      AND (id = ${requestIdOrFollowerId} OR follower_id = ${requestIdOrFollowerId})
    RETURNING id
  `;

  return res.length > 0;
}

async function getFollowers(userId) {
  const rows = await sql`
    SELECT
      f.id, f.follower_id, f.following_id, f.status, f.created_at,
      u.id as u_id, u.name as u_name, u.first_name as u_first_name, u.last_name as u_last_name,
      u.username as u_username, u.bio as u_bio, u.avatar_url as u_avatar_url,
      u.badge_type as u_badge_type, u.email_verified as u_email_verified, u.is_private as u_is_private
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ${userId}
      AND f.status = 'ACCEPTED'
    ORDER BY f.created_at DESC
  `;

  return rows.map((item) => {
    const isLoyal = isLoyalFollower(item.created_at);
    return {
      follow_id: item.id,
      user_id: item.follower_id,
      status: item.status,
      created_at: item.created_at,
      following_since: item.created_at,
      is_loyal_follower: isLoyal,
      user: formatFollowUser({
        id: item.u_id,
        name: item.u_name,
        first_name: item.u_first_name,
        last_name: item.u_last_name,
        username: item.u_username,
        bio: item.u_bio,
        avatar_url: item.u_avatar_url,
        badge_type: item.u_badge_type,
        email_verified: item.u_email_verified,
        is_private: item.u_is_private
      })
    };
  });
}

async function getFollowing(userId) {
  const rows = await sql`
    SELECT
      f.id, f.follower_id, f.following_id, f.status, f.created_at,
      u.id as u_id, u.name as u_name, u.first_name as u_first_name, u.last_name as u_last_name,
      u.username as u_username, u.bio as u_bio, u.avatar_url as u_avatar_url,
      u.badge_type as u_badge_type, u.email_verified as u_email_verified, u.is_private as u_is_private
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ${userId}
      AND f.status = 'ACCEPTED'
    ORDER BY f.created_at DESC
  `;

  return rows.map((item) => ({
    follow_id: item.id,
    user_id: item.following_id,
    status: item.status,
    created_at: item.created_at,
    following_since: item.created_at,
    user: formatFollowUser({
      id: item.u_id,
      name: item.u_name,
      first_name: item.u_first_name,
      last_name: item.u_last_name,
      username: item.u_username,
      bio: item.u_bio,
      avatar_url: item.u_avatar_url,
      badge_type: item.u_badge_type,
      email_verified: item.u_email_verified,
      is_private: item.u_is_private
    })
  }));
}

async function isMutualFollow(userA, userB) {
  if (!userA || !userB) return false;
  if (userA === userB) return true;
  const [followAB, followBA] = await Promise.all([
  findFollow(userA, userB),
  findFollow(userB, userA)]
  );
  return Boolean(
    followAB && followAB.status === "ACCEPTED" &&
    followBA && followBA.status === "ACCEPTED"
  );
}

module.exports = {
  createFollow,
  getAllFollows,
  getFollowById,
  updateFollow,
  deleteFollow,
  findFollow,
  isFollowingAccepted,
  isMutualFollow,
  getAcceptedFollowingIds,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  getFollowers,
  getFollowing,
  isLoyalFollower
};