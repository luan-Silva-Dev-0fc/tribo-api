const { sql } = require('../config/database');

async function createGroup(name, description, avatarUrl, rules, createdBy) {
  const [group] = await sql`
    INSERT INTO groups (name, description, avatar_url, rules, created_by)
    VALUES (${name ?? null}, ${description ?? null}, ${avatarUrl ?? null}, ${rules ?? null}, ${createdBy ?? null})
    RETURNING *, created_by as admin_id, created_by as owner_id;
  `;

  await addGroupMember(group.id, createdBy, 'ADMIN');
  return group;
}

async function getGroupById(id) {
  const [group] = await sql`
    SELECT g.*, g.created_by as admin_id, g.created_by as owner_id
    FROM groups g
    WHERE g.id = ${id}
  `;
  return group;
}

async function updateGroup(id, name, description, avatarUrl, rules) {
  const [current] = await sql`SELECT * FROM groups WHERE id = ${id}`;
  if (!current) return null;

  const updatedName = name !== undefined && name !== null ? name : current.name;
  const updatedDesc = description !== undefined ? description : current.description;
  const updatedAvatar = avatarUrl !== undefined ? avatarUrl : current.avatar_url;
  const updatedRules = rules !== undefined ? rules : current.rules;

  const [group] = await sql`
    UPDATE groups
    SET name = ${updatedName ?? null},
        description = ${updatedDesc ?? null},
        avatar_url = ${updatedAvatar ?? null},
        rules = ${updatedRules ?? null},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *, created_by as admin_id, created_by as owner_id;
  `;
  return group;
}

async function deleteGroup(id) {
  await sql`DELETE FROM groups WHERE id = ${id}`;
  return true;
}

async function getUserGroups(userId) {
  return await sql`
    SELECT g.*, g.created_by as admin_id, g.created_by as owner_id, gm.role, gm.created_at as joined_at
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ${userId}
    ORDER BY g.created_at DESC;
  `;
}

async function isGroupMember(groupId, userId) {
  const [member] = await sql`
    SELECT * FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (member) return member;
  const [group] = await sql`
    SELECT * FROM groups WHERE id = ${groupId} AND created_by = ${userId}
  `;
  if (group) {
    return {
      group_id: groupId,
      user_id: userId,
      role: 'ADMIN',
      created_at: group.created_at
    };
  }
  return null;
}

async function getGroupMembers(groupId) {
  return await sql`
    SELECT gm.role, gm.created_at as joined_at, u.id, u.username, u.name, u.avatar_url
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ${groupId}
    ORDER BY gm.created_at ASC;
  `;
}

async function checkMutualFollow(userA, userB) {
  const [aFollowsB] = await sql`SELECT 1 FROM follows WHERE follower_id = ${userA} AND following_id = ${userB}`;
  const [bFollowsA] = await sql`SELECT 1 FROM follows WHERE follower_id = ${userB} AND following_id = ${userA}`;
  return !!(aFollowsB && bFollowsA);
}

async function addGroupMember(groupId, userId, role = 'MEMBER') {
  const [member] = await sql`
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (${groupId}, ${userId}, ${role})
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
    RETURNING *;
  `;
  return member;
}

async function removeGroupMember(groupId, userId) {
  await sql`DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
  return true;
}

async function createGroupPost(groupId, userId, content, mediaUrl, audioUrl, isNSFW = false) {
  const [post] = await sql`
    INSERT INTO group_posts (group_id, user_id, content, media_url, audio_url, is_nsfw)
    VALUES (${groupId}, ${userId}, ${content || null}, ${mediaUrl || null}, ${audioUrl || null}, ${isNSFW})
    RETURNING *;
  `;
  return post;
}

async function getGroupFeed(groupId, userId, limit = 20) {
  return await sql`
    SELECT
      gp.*,
      u.username,
      u.name,
      u.avatar_url as user_avatar,
      (SELECT count(*) FROM group_post_likes gpl WHERE gpl.post_id = gp.id) as likes_count,
      (SELECT count(*) FROM group_post_comments gpc WHERE gpc.post_id = gp.id) as comments_count,
      EXISTS (SELECT 1 FROM group_post_likes gpl WHERE gpl.post_id = gp.id AND gpl.user_id = ${userId}) as is_liked,
      EXISTS (SELECT 1 FROM group_saved_posts gsp WHERE gsp.post_id = gp.id AND gsp.user_id = ${userId}) as is_saved
    FROM group_posts gp
    JOIN users u ON gp.user_id = u.id
    WHERE gp.group_id = ${groupId}
    ORDER BY gp.created_at DESC
    LIMIT ${limit};
  `;
}

async function likeGroupPost(postId, userId) {
  return await sql`
    INSERT INTO group_post_likes (post_id, user_id)
    VALUES (${postId}, ${userId})
    ON CONFLICT DO NOTHING
  `;
}

async function unlikeGroupPost(postId, userId) {
  return await sql`
    DELETE FROM group_post_likes
    WHERE post_id = ${postId} AND user_id = ${userId}
  `;
}

async function saveGroupPost(postId, userId) {
  return await sql`
    INSERT INTO group_saved_posts (post_id, user_id)
    VALUES (${postId}, ${userId})
    ON CONFLICT DO NOTHING
  `;
}

async function unsaveGroupPost(postId, userId) {
  return await sql`
    DELETE FROM group_saved_posts
    WHERE post_id = ${postId} AND user_id = ${userId}
  `;
}

async function getGroupPostComments(postId, limit = 50) {
  return await sql`
    SELECT
      gpc.*,
      u.username,
      u.name,
      u.avatar_url as user_avatar,
      u.badge_type,
      u.email_verified
    FROM group_post_comments gpc
    JOIN users u ON gpc.user_id = u.id
    WHERE gpc.post_id = ${postId}
    ORDER BY gpc.created_at ASC
    LIMIT ${limit};
  `;
}

async function addGroupPostComment(postId, userId, content, audio_url = null) {
  const [comment] = await sql`
    INSERT INTO group_post_comments (post_id, user_id, content, audio_url)
    VALUES (${postId}, ${userId}, ${content ?? null}, ${audio_url ?? null})
    RETURNING *
  `;
  return comment;
}

async function deleteGroupPostComment(commentId) {
  return await sql`DELETE FROM group_post_comments WHERE id = ${commentId}`;
}

async function deleteGroupPost(postId) {
  await sql`DELETE FROM group_posts WHERE id = ${postId}`;
  return true;
}

async function createGroupMessage(groupId, userId, content, mediaUrl, audioUrl, storyId, mediaType, isViewOnce) {
  const [msg] = await sql`
    INSERT INTO group_messages (group_id, user_id, content, media_url, audio_url, story_id, media_type, is_view_once)
    VALUES (${groupId}, ${userId}, ${content || null}, ${mediaUrl || null}, ${audioUrl || null}, ${storyId || null}, ${mediaType || null}, ${Boolean(isViewOnce)})
    RETURNING *;
  `;
  return msg;
}

async function getGroupChat(groupId, limit = 50, currentUserId = null) {
  if (currentUserId) {
    return await sql`
      SELECT gm.*, u.username, u.name, u.avatar_url as user_avatar
      FROM group_messages gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ${groupId}
        AND NOT (${currentUserId}::uuid = ANY(COALESCE(gm.deleted_by_users, '{}')))
      ORDER BY gm.created_at DESC
      LIMIT ${limit};
    `;
  }
  return await sql`
    SELECT gm.*, u.username, u.name, u.avatar_url as user_avatar
    FROM group_messages gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ${groupId}
    ORDER BY gm.created_at DESC
    LIMIT ${limit};
  `;
}

async function deleteGroupMessage(messageId) {
  await sql`DELETE FROM group_messages WHERE id = ${messageId}`;
  return true;
}

async function getGroupTrends(groupId) {
  return await sql`
    SELECT * FROM group_trends
    WHERE group_id = ${groupId}
    ORDER BY created_at DESC;
  `;
}

async function saveGroupTrends(groupId, trendsArray) {

  await sql`DELETE FROM group_trends WHERE group_id = ${groupId}`;

  if (!trendsArray || trendsArray.length === 0) return [];

  const values = trendsArray.map((t) => ({
    group_id: groupId,
    topic_name: t.topic_name,
    summary: t.summary || null,
    target_message_id: t.target_message_id || null
  }));

  const inserted = await sql`
    INSERT INTO group_trends ${sql(values)}
    RETURNING *;
  `;
  return inserted;
}

async function reportGroup(groupId, userId, reason) {
  const [report] = await sql`
    INSERT INTO group_reports (group_id, user_id, reason)
    VALUES (${groupId}, ${userId}, ${reason})
    RETURNING *;
  `;
  return report;
}

async function incrementDownloadCount(groupId, postId) {
  await sql`
    UPDATE group_posts
    SET downloads_count = COALESCE(downloads_count, 0) + 1
    WHERE id = ${postId} AND group_id = ${groupId}
  `;
}

async function isUserBanned(groupId, userId) {
  const [banned] = await sql`
    SELECT * FROM group_bans
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return !!banned;
}

async function banGroupMember(groupId, userId, bannedBy, reason) {

  await removeGroupMember(groupId, userId);

  const [ban] = await sql`
    INSERT INTO group_bans (group_id, user_id, banned_by, reason)
    VALUES (${groupId}, ${userId}, ${bannedBy}, ${reason || null})
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, created_at = NOW()
    RETURNING *;
  `;
  return ban;
}

async function unbanGroupMember(groupId, userId) {
  await sql`
    DELETE FROM group_bans
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return true;
}

async function getBannedMembers(groupId) {
  return await sql`
    SELECT gb.created_at as banned_at, gb.reason, u.id, u.username, u.name, u.avatar_url
    FROM group_bans gb
    JOIN users u ON gb.user_id = u.id
    WHERE gb.group_id = ${groupId}
    ORDER BY gb.created_at DESC;
  `;
}

async function setGroupNotificationMuted(groupId, userId, muted) {
  const isMuted = Boolean(muted);
  const [setting] = await sql`
    INSERT INTO group_notification_settings (group_id, user_id, muted)
    VALUES (${groupId}, ${userId}, ${isMuted})
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET muted = EXCLUDED.muted
    RETURNING *;
  `;
  return setting;
}

async function isGroupNotificationMuted(groupId, userId) {
  const [setting] = await sql`
    SELECT muted FROM group_notification_settings
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  return setting ? Boolean(setting.muted) : false;
}

module.exports = {
  createGroup,
  getGroupById,
  updateGroup,
  deleteGroup,
  getUserGroups,
  isGroupMember,
  getGroupMembers,
  checkMutualFollow,
  addGroupMember,
  removeGroupMember,
  createGroupPost,
  getGroupFeed,
  likeGroupPost,
  unlikeGroupPost,
  saveGroupPost,
  unsaveGroupPost,
  getGroupPostComments,
  addGroupPostComment,
  deleteGroupPostComment,
  deleteGroupPost,
  createGroupMessage,
  getGroupChat,
  deleteGroupMessage,
  getGroupTrends,
  saveGroupTrends,
  reportGroup,
  incrementDownloadCount,
  isUserBanned,
  banGroupMember,
  unbanGroupMember,
  getBannedMembers,
  setGroupNotificationMuted,
  isGroupNotificationMuted
};