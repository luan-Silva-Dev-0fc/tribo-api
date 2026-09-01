const { supabase, sql } = require("../config/database");
const { getBlockedUserIds } = require("./blockModel");

const USER_PUBLIC_FIELDS = "id, name, first_name, last_name, username, bio, avatar_url, badge_type, email_verified, is_private, allow_nsfw_content, show_online_status, read_receipts, last_seen, status, role, created_at, updated_at";

function formatUserData(user, viewerSettings = null, isSelf = false) {
  if (!user) return null;
  const bio = user.bio && String(user.bio).trim() !== "" ? String(user.bio).trim() : null;

  const showOnlineStatus = user.show_online_status !== undefined && user.show_online_status !== null ?
  Boolean(user.show_online_status) :
  true;
  const readReceipts = user.read_receipts !== undefined && user.read_receipts !== null ?
  Boolean(user.read_receipts) :
  true;
  const allowNsfwContent = Boolean(user.allow_nsfw_content);

  const lastSeenDate = user.last_seen ? new Date(user.last_seen) : null;
  const isActuallyOnline = lastSeenDate ? Date.now() - lastSeenDate.getTime() < 5 * 60 * 1000 : false;

  let isOnline = null;
  let lastSeen = null;

  if (isSelf) {
    isOnline = isActuallyOnline;
    lastSeen = user.last_seen || null;
  } else {

    const viewerAllowsOnline = viewerSettings ? viewerSettings.showOnlineStatus !== false : true;
    if (showOnlineStatus && viewerAllowsOnline) {
      isOnline = isActuallyOnline;
      lastSeen = user.last_seen || null;
    }
  }

  return {
    id: user.id,
    name: user.name,
    first_name: user.first_name || user.name || "",
    last_name: user.last_name || "",
    username: user.username,
    bio,
    avatar_url: user.avatar_url,
    badge_type: user.badge_type || (user.verified || user.email_verified ? 'BLUE' : 'NONE'),
    badge: user.badge_type || (user.verified || user.email_verified ? 'BLUE' : 'NONE'),
    email_verified: Boolean(user.email_verified || user.verified),
    is_verified: user.badge_type === 'GOLD' || user.badge_type === 'BLUE' || Boolean(user.verified || user.email_verified),
    is_private: Boolean(user.is_private),
    allow_nsfw_content: allowNsfwContent,
    allowNsfwContent: allowNsfwContent,
    show_online_status: showOnlineStatus,
    showOnlineStatus,
    read_receipts: readReceipts,
    readReceipts,
    is_online: isOnline,
    isOnline,
    last_seen: lastSeen,
    lastSeen,
    status: user.status || "ACTIVE",
    role: user.role || "USER",
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
    ...(isSelf ? { email: user.email } : {})
  };
}

function isTestAccount(user) {
  if (!user) return false;
  const username = String(user.username || "").toLowerCase();
  const email = String(user.email || "").toLowerCase();
  const name = String(user.name || "").toLowerCase();
  return (
    username.startsWith("user_a_") ||
    username.startsWith("user_b_") ||
    username.startsWith("tester_") ||
    username.startsWith("test_") ||
    email.includes("example.com") ||
    email.includes("test_") ||
    name.startsWith("user a ") ||
    name.startsWith("user b ") ||
    name.startsWith("tester "));

}

async function getUserSettings(userId) {
  if (!userId) return null;
  const [user] = await sql`
    SELECT id, show_online_status, read_receipts, is_private, allow_nsfw_content
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) return null;
  const showOnlineStatus = user.show_online_status !== undefined && user.show_online_status !== null ?
  Boolean(user.show_online_status) :
  true;
  const readReceipts = user.read_receipts !== undefined && user.read_receipts !== null ?
  Boolean(user.read_receipts) :
  true;
  const isPrivate = Boolean(user.is_private);
  const allowNsfwContent = Boolean(user.allow_nsfw_content);

  return {
    show_online_status: showOnlineStatus,
    showOnlineStatus,
    read_receipts: readReceipts,
    readReceipts,
    is_private: isPrivate,
    isPrivate,
    allow_nsfw_content: allowNsfwContent,
    allowNsfwContent
  };
}

async function updateUserSettings(userId, payload = {}) {
  const current = await getUserSettings(userId);
  if (!current) return null;

  const newShowOnline = payload.showOnlineStatus !== undefined ?
  Boolean(payload.showOnlineStatus) :
  payload.show_online_status !== undefined ?
  Boolean(payload.show_online_status) :
  current.showOnlineStatus;

  const newReadReceipts = payload.readReceipts !== undefined ?
  Boolean(payload.readReceipts) :
  payload.read_receipts !== undefined ?
  Boolean(payload.read_receipts) :
  current.readReceipts;

  const newIsPrivate = payload.isPrivate !== undefined ?
  Boolean(payload.isPrivate) :
  payload.is_private !== undefined ?
  Boolean(payload.is_private) :
  current.isPrivate;

  const newAllowNsfw = payload.allow_nsfw_content !== undefined ?
  Boolean(payload.allow_nsfw_content) :
  payload.allowNsfwContent !== undefined ?
  Boolean(payload.allowNsfwContent) :
  payload.is_adult_content_enabled !== undefined ?
  Boolean(payload.is_adult_content_enabled) :
  payload.isAdultContentEnabled !== undefined ?
  Boolean(payload.isAdultContentEnabled) :
  current.allowNsfwContent;

  const [updated] = await sql`
    UPDATE users
    SET show_online_status = ${newShowOnline},
        read_receipts = ${newReadReceipts},
        is_private = ${newIsPrivate},
        allow_nsfw_content = ${newAllowNsfw},
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, show_online_status, read_receipts, is_private, allow_nsfw_content, updated_at
  `;

  return {
    show_online_status: Boolean(updated.show_online_status),
    showOnlineStatus: Boolean(updated.show_online_status),
    read_receipts: Boolean(updated.read_receipts),
    readReceipts: Boolean(updated.read_receipts),
    is_private: Boolean(updated.is_private),
    isPrivate: Boolean(updated.is_private),
    allow_nsfw_content: Boolean(updated.allow_nsfw_content),
    allowNsfwContent: Boolean(updated.allow_nsfw_content)
  };
}

async function updateUserLastSeen(userId) {
  if (!userId) return;
  try {
    await sql`UPDATE users SET last_seen = NOW() WHERE id = ${userId}`;
  } catch (e) {

  }
}

async function getAllUsers(viewerId, search = "") {
  let query = supabase.
  from("users").
  select(USER_PUBLIC_FIELDS).
  eq("status", "ACTIVE").
  order("created_at", { ascending: false });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`name.ilike.%${term}%,username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }

  const [usersResult, blockedIds, viewerSettings] = await Promise.all([
  query,
  viewerId ? getBlockedUserIds(viewerId) : Promise.resolve(new Set()),
  viewerId ? getUserSettings(viewerId) : Promise.resolve(null)]
  );

  if (usersResult.error) throw usersResult.error;

  const data = (usersResult.data || []).
  filter((user) => {

    if (viewerId && user.id === viewerId) return false;

    if (viewerId && blockedIds.has(user.id)) return false;

    if (isTestAccount(user)) return false;
    return true;
  }).
  map((user) => formatUserData(user, viewerSettings, false));

  return data;
}

async function searchUsers(search, viewerId) {
  return getAllUsers(viewerId, search);
}

async function getUserById(id, viewerId) {
  if (!id) return null;

  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isValidUuid) {
    return null;
  }

  const [user] = await sql`
    SELECT
      id, name, first_name, last_name, username, email, bio,
      avatar_url, badge_type, email_verified, is_private, allow_nsfw_content,
      show_online_status, read_receipts, last_seen,
      status, role, created_at, updated_at
    FROM users
    WHERE id = ${id}
  `;

  if (!user) return null;
  if (user.status === "BANNED") return null;

  const blockedIds = viewerId ? await getBlockedUserIds(viewerId) : new Set();
  if (viewerId && viewerId !== id && blockedIds.has(id)) {
    return null;
  }

  const isSelf = viewerId === id;
  const viewerSettings = viewerId && !isSelf ? await getUserSettings(viewerId) : null;

  const [followersCountRow] = await sql`
    SELECT COUNT(*)::int as count FROM follows WHERE following_id = ${id} AND status = 'ACCEPTED'
  `;
  const [followingCountRow] = await sql`
    SELECT COUNT(*)::int as count FROM follows WHERE follower_id = ${id} AND status = 'ACCEPTED'
  `;

  let followStatus = "NONE";
  let isFollowing = false;
  let isPending = false;
  let canViewContent = !Boolean(user.is_private);

  if (viewerId) {
    if (isSelf) {
      followStatus = "SELF";
      canViewContent = true;
    } else {
      const [followRow] = await sql`
        SELECT status FROM follows WHERE follower_id = ${viewerId} AND following_id = ${id} LIMIT 1
      `;
      if (followRow) {
        if (followRow.status === "ACCEPTED") {
          followStatus = "ACCEPTED";
          isFollowing = true;
          canViewContent = true;
        } else if (followRow.status === "PENDING") {
          followStatus = "PENDING";
          isPending = true;
          canViewContent = !Boolean(user.is_private);
        }
      }
    }
  }

  const baseUser = formatUserData(user, viewerSettings, isSelf);

  return {
    ...baseUser,
    followers_count: followersCountRow ? followersCountRow.count : 0,
    followersCount: followersCountRow ? followersCountRow.count : 0,
    following_count: followingCountRow ? followingCountRow.count : 0,
    followingCount: followingCountRow ? followingCountRow.count : 0,
    follow_status: followStatus,
    followStatus: followStatus,
    is_following: isFollowing,
    isFollowing: isFollowing,
    is_pending: isPending,
    isPending: isPending,
    can_view_content: canViewContent,
    canViewContent: canViewContent
  };
}

async function updateUserPrivacy(id, isPrivate) {
  return updateUserSettings(id, { is_private: isPrivate });
}

async function getAdminUsersList() {
  const { data, error } = await supabase.
  from("users").
  select("id, name, first_name, last_name, email, username, bio, avatar_url, badge_type, email_verified, show_online_status, read_receipts, last_seen, status, role, created_at, updated_at, banned_at, ban_reason").
  order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((u) => formatUserData(u, null, true));
}

async function updateUser(id, payload) {
  const { data, error } = await supabase.
  from("users").
  update(payload).
  eq("id", id).
  select().
  single();
  if (error) throw error;
  return formatUserData(data, null, true);
}

async function deleteUser(id) {
  const { error } = await supabase.
  from("users").
  update({ is_deleted: true, status: 'DELETED' }).
  eq("id", id);
  if (error) throw error;
}

async function getSuggestedUsers(userId) {
  const [usersResult, followsResult, blocksResult, viewerSettings] = await Promise.all([
  supabase.from("users").select(USER_PUBLIC_FIELDS).eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(100),
  supabase.from("follows").select("following_id").eq("follower_id", userId),
  supabase.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
  getUserSettings(userId)]
  );
  if (usersResult.error) throw usersResult.error;
  if (followsResult.error) throw followsResult.error;
  if (blocksResult.error) throw blocksResult.error;
  const excluded = new Set([userId, ...(followsResult.data || []).map((follow) => follow.following_id)]);
  for (const block of blocksResult.data || []) {
    excluded.add(block.blocker_id === userId ? block.blocked_id : block.blocker_id);
  }
  return (usersResult.data || []).
  filter((user) => !excluded.has(user.id) && !isTestAccount(user)).
  slice(0, 20).
  map((user) => formatUserData(user, viewerSettings, false));
}

async function updateUserStatus(id, payload) {
  const { data, error } = await supabase.from("users").update(payload).eq("id", id).select("id, username, status, role, banned_at, ban_reason, badge_type, email_verified").maybeSingle();
  if (error) throw error;
  return formatUserData(data, null, true);
}

async function updateUserBadge(id, badgeType) {
  const normalized = String(badgeType || 'NONE').toUpperCase();
  const isGold = normalized === 'GOLD';
  const isBlue = normalized === 'BLUE';

  const updatePayload = {
    badge_type: normalized
  };

  if (isGold || isBlue) {
    updatePayload.verified = true;
    updatePayload.email_verified = true;
  } else if (normalized === 'NONE') {
    updatePayload.verified = false;
  }

  const { data, error } = await supabase.
  from("users").
  update(updatePayload).
  eq("id", id).
  select(USER_PUBLIC_FIELDS).
  maybeSingle();
  if (error) throw error;
  return formatUserData(data, null, true);
}

async function scheduleAccountDeletion(userId, password) {
  if (!userId) {
    const err = new Error("ID do usuário é obrigatório.");
    err.status = 400;
    throw err;
  }

  const [user] = await sql`
    SELECT id, username, email, password, status, data_exported_at, created_at
    FROM users
    WHERE id = ${userId};
  `;

  if (!user) {
    const err = new Error("Usuário não encontrado.");
    err.status = 404;
    throw err;
  }

  if (!password || !String(password).trim()) {
    const err = new Error("A senha atual é obrigatória para confirmar a exclusão da conta.");
    err.status = 400;
    throw err;
  }

  const bcrypt = require("bcrypt");
  const isPasswordValid = await bcrypt.compare(String(password).trim(), user.password || "");
  if (!isPasswordValid) {
    const err = new Error("Senha incorreta. Verifique sua senha e tente novamente.");
    err.status = 401;
    throw err;
  }

  const now = new Date();
  const effectiveDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const [updated] = await sql`
    UPDATE users
    SET
      status = 'PENDING_DELETION',
      deletion_scheduled_at = ${now.toISOString()},
      deletion_effective_at = ${effectiveDate.toISOString()},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, username, status, deletion_scheduled_at, deletion_effective_at, data_exported_at;
  `;

  return {
    success: true,
    status: "PENDING_DELETION",
    message: "Sua conta foi agendada para exclusão e será permanentemente apagada em 15 dias.",
    deletionScheduledAt: updated.deletion_scheduled_at,
    deletionEffectiveAt: updated.deletion_effective_at,
    daysRemaining: 15,
    dataExportedAt: updated.data_exported_at
  };
}

async function cancelAccountDeletion(userId) {
  if (!userId) {
    const err = new Error("ID do usuário é obrigatório.");
    err.status = 400;
    throw err;
  }

  const [user] = await sql`
    SELECT id, username, status, deletion_scheduled_at
    FROM users
    WHERE id = ${userId};
  `;

  if (!user) {
    const err = new Error("Usuário não encontrado.");
    err.status = 404;
    throw err;
  }

  await sql`
    UPDATE users
    SET
      status = 'ACTIVE',
      deletion_scheduled_at = NULL,
      deletion_effective_at = NULL,
      updated_at = NOW()
    WHERE id = ${userId};
  `;

  return {
    success: true,
    status: "ACTIVE",
    message: "Agendamento de exclusão cancelado com sucesso. Sua conta continua ativa."
  };
}

async function getDeletionStatus(userId) {
  if (!userId) return null;

  const [user] = await sql`
    SELECT id, username, status, deletion_scheduled_at, deletion_effective_at, data_exported_at, created_at
    FROM users
    WHERE id = ${userId};
  `;

  if (!user) return null;

  let daysRemaining = null;
  const isPending = user.status === "PENDING_DELETION" && Boolean(user.deletion_effective_at);

  if (isPending) {
    const msRemaining = new Date(user.deletion_effective_at).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  return {
    isPendingDeletion: isPending,
    status: user.status,
    deletionScheduledAt: user.deletion_scheduled_at || null,
    deletionEffectiveAt: user.deletion_effective_at || null,
    daysRemaining,
    dataExportedAt: user.data_exported_at || null,
    hasExportedData: Boolean(user.data_exported_at),
    accountCreatedAt: user.created_at
  };
}

async function purgeExpiredDeletedAccounts() {
  const expiredUsers = await sql`
    SELECT id, username, deletion_effective_at
    FROM users
    WHERE status = 'PENDING_DELETION'
      AND deletion_effective_at IS NOT NULL
      AND deletion_effective_at <= NOW();
  `;

  if (expiredUsers.length === 0) {
    return { purgedCount: 0, purgedUsers: [] };
  }

  const idsToPurge = expiredUsers.map((u) => u.id);
  await sql`
    DELETE FROM users
    WHERE id = ANY(${idsToPurge});
  `;

  return {
    purgedCount: idsToPurge.length,
    purgedUsers: expiredUsers
  };
}

async function getUnverifiedUsers(limit = 50, offset = 0) {
  const users = await sql`
    SELECT id, username, name, email, badge_type, email_verified, created_at
    FROM users
    WHERE (email_verified = false OR email_verified IS NULL) AND (verified = false OR verified IS NULL) AND (badge_type IS NULL OR badge_type = 'NONE')
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*) as count
    FROM users
    WHERE (email_verified = false OR email_verified IS NULL) AND (verified = false OR verified IS NULL) AND (badge_type IS NULL OR badge_type = 'NONE');
  `;

  return {
    data: users,
    total: Number(count),
    limit,
    offset
  };
}

async function wipeUserData(userId) {
  return await sql.begin(async (tx) => {
    // 1. Comments
    await tx`DELETE FROM comments WHERE user_id = ${userId} OR author_id = ${userId}`;
    // 2. Likes, Reposts, Saves & Interactions
    await tx`DELETE FROM likes WHERE user_id = ${userId}`;
    await tx`DELETE FROM reposts WHERE user_id = ${userId}`;
    await tx`DELETE FROM saved_posts WHERE user_id = ${userId}`;
    await tx`DELETE FROM reel_likes WHERE user_id = ${userId}`;
    await tx`DELETE FROM user_reel_interactions WHERE user_id = ${userId}`;
    await tx`DELETE FROM user_reel_preferences WHERE user_id = ${userId}`;
    // 3. Stories
    await tx`DELETE FROM story_likes WHERE user_id = ${userId}`;
    await tx`DELETE FROM story_views WHERE user_id = ${userId}`;
    await tx`DELETE FROM stories WHERE user_id = ${userId}`;
    // 4. Audio tracks & Stickers
    await tx`DELETE FROM tracks WHERE user_id = ${userId}`;
    await tx`DELETE FROM sticker_favorites WHERE user_id = ${userId}`;
    await tx`DELETE FROM stickers WHERE user_id = ${userId}`;
    // 5. Messages & Conversations
    await tx`DELETE FROM messages WHERE sender_id = ${userId}`;
    await tx`DELETE FROM conversation_members WHERE user_id = ${userId}`;
    // 6. Group Content & Memberships
    await tx`DELETE FROM group_post_comments WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_post_likes WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_saved_posts WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_messages WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_posts WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_members WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_bans WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_reports WHERE user_id = ${userId}`;
    await tx`DELETE FROM group_notification_settings WHERE user_id = ${userId}`;
    // 7. Social Graph, Notifications, Blocks & Tokens
    await tx`DELETE FROM notifications WHERE user_id = ${userId} OR sender_id = ${userId}`;
    await tx`DELETE FROM follows WHERE follower_id = ${userId} OR following_id = ${userId}`;
    await tx`DELETE FROM blocks WHERE blocker_id = ${userId} OR blocked_id = ${userId}`;
    await tx`DELETE FROM blocked_users WHERE blocker_id = ${userId} OR blocked_id = ${userId}`;
    await tx`DELETE FROM user_push_tokens WHERE user_id = ${userId}`;
    // 8. Feed Posts
    await tx`DELETE FROM posts WHERE user_id = ${userId} OR author_id = ${userId}`;
    // 9. Reset User Profile Data (keeps credentials, resets public content)
    const [updatedUser] = await tx`
      UPDATE users
      SET
        bio = NULL,
        avatar = NULL,
        avatar_url = NULL,
        banner = NULL,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, name, username, email, status, badge_type;
    `;
    return updatedUser;
  });
}

async function deleteUserCompletely(userId) {
  await wipeUserData(userId);
  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { success: true, id: userId };
}

module.exports = {
  getAllUsers,
  searchUsers,
  getUserById,
  getUserSettings,
  updateUserSettings,
  updateUserLastSeen,
  getAdminUsersList,
  updateUser,
  deleteUser,
  wipeUserData,
  deleteUserCompletely,
  scheduleAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  purgeExpiredDeletedAccounts,
  getUnverifiedUsers,
  getSuggestedUsers,
  updateUserStatus,
  updateUserBadge,
  updateUserPrivacy,
  formatUserData
};