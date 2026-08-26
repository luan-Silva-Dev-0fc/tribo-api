const { supabase, sql } = require("../config/database");

async function getNotificationsByUser(userId) {
  try {
    const rows = await sql`
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.message,
        n.created_at,
        COALESCE(n.is_read, n.read, false) as is_read,
        n.post_id,
        n.comment_id,
        COALESCE(n.actor_id, n.sender_id, u_fallback.id) as actor_id,
        COALESCE(u.username, u_fallback.username) as actor_username,
        COALESCE(u.name, u_fallback.name) as actor_name,
        COALESCE(u.avatar_url, u_fallback.avatar_url) as actor_avatar_url,
        p.media_url as post_media
      FROM notifications n
      LEFT JOIN users u ON u.id = COALESCE(n.actor_id, n.sender_id)
      -- Fallback caso o actor_id seja nulo mas o @username esteja na mensagem
      LEFT JOIN users u_fallback ON (
        COALESCE(n.actor_id, n.sender_id) IS NULL
        AND n.message LIKE '@' || u_fallback.username || '%'
      )
      LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = ${userId}
      ORDER BY n.created_at DESC
      LIMIT 60;
    `;

    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type || "GENERIC",
      message: row.message,
      created_at: row.created_at,
      is_read: Boolean(row.is_read),
      read: Boolean(row.is_read),
      post_id: row.post_id,
      comment_id: row.comment_id,
      post_media: row.post_media,
      actor: row.actor_username || row.actor_name ? {
        id: row.actor_id,
        username: row.actor_username,
        name: row.actor_name,
        avatar_url: row.actor_avatar_url,
        avatar: row.actor_avatar_url
      } : null,
      actor_id: row.actor_id,
      actor_username: row.actor_username,
      actor_name: row.actor_name,
      actor_avatar: row.actor_avatar_url,
      actor_avatar_url: row.actor_avatar_url
    }));
  } catch (err) {
    console.warn("Fallback to supabase client for notifications query:", err.message);
    const { data, error } = await supabase.
    from("notifications").
    select("*").
    eq("user_id", userId).
    order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

async function getNotificationById(id) {
  const { data, error } = await supabase.
  from("notifications").
  select("*").
  eq("id", id).
  maybeSingle();
  if (error) throw error;
  return data;
}

async function createNotification(payload) {
  const { data, error } = await supabase.
  from("notifications").
  insert(payload).
  select().
  single();
  if (error) throw error;
  return data;
}

async function updateNotification(id, payload) {
  const { data, error } = await supabase.
  from("notifications").
  update(payload).
  eq("id", id).
  select().
  maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteNotification(id) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

async function markAllAsRead(userId) {
  try {
    await sql`
      UPDATE notifications
      SET is_read = true, read = true
      WHERE user_id = ${userId} AND (is_read = false OR is_read IS NULL);
    `;
  } catch (err) {
    await supabase.from("notifications").update({ is_read: true, read: true }).eq("user_id", userId).eq("is_read", false);
  }
}

module.exports = {
  getNotificationsByUser,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAllAsRead
};