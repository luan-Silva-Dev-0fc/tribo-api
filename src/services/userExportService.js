const { sql } = require("../config/database");

async function generateUserDataExport(userId) {
  if (!userId) {
    throw new Error("ID do usuário é obrigatório para exportação de dados.");
  }

  const [user] = await sql`
    SELECT
      id, name, first_name, last_name, username, email, bio,
      COALESCE(avatar_url, avatar) AS avatar_url, banner, badge_type,
      email_verified, verified, is_private, private_account,
      show_online_status, read_receipts, last_seen, status, role,
      created_at, updated_at, deletion_scheduled_at,
      deletion_effective_at, data_exported_at
    FROM users
    WHERE id = ${userId};
  `;

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  const followers = await sql`
    SELECT
      u.id, u.username, u.name, COALESCE(u.avatar_url, u.avatar) AS avatar_url, f.created_at AS followed_at
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    WHERE f.following_id = ${userId} AND f.status = 'ACCEPTED'
    ORDER BY f.created_at DESC;
  `;

  const following = await sql`
    SELECT
      u.id, u.username, u.name, COALESCE(u.avatar_url, u.avatar) AS avatar_url, f.created_at AS followed_at
    FROM follows f
    JOIN users u ON u.id = f.following_id
    WHERE f.follower_id = ${userId} AND f.status = 'ACCEPTED'
    ORDER BY f.created_at DESC;
  `;

  const messages = await sql`
    SELECT
      m.id,
      m.sender_id,
      sender.username AS sender_username,
      sender.name AS sender_name,
      m.receiver_id,
      receiver.username AS receiver_username,
      receiver.name AS receiver_name,
      COALESCE(m.content, m.message, '') AS content,
      m.media_url,
      m.audio_url,
      m.created_at
    FROM messages m
    LEFT JOIN users sender ON sender.id = m.sender_id
    LEFT JOIN users receiver ON receiver.id = m.receiver_id
    WHERE (m.sender_id = ${userId} OR m.receiver_id = ${userId})
      AND m.deleted_at IS NULL
    ORDER BY m.created_at ASC;
  `;

  const posts = await sql`
    SELECT
      id, content, media_url, image_url, video_url, audio_url, is_nsfw, created_at, updated_at
    FROM posts
    WHERE (user_id = ${userId} OR author_id = ${userId})
      AND deleted_at IS NULL
    ORDER BY created_at DESC;
  `;

  const comments = await sql`
    SELECT
      id, post_id, content, parent_id, created_at
    FROM comments
    WHERE (user_id = ${userId} OR author_id = ${userId})
    ORDER BY created_at DESC;
  `;

  const likes = await sql`
    SELECT
      id, post_id, comment_id, created_at
    FROM likes
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  const stories = await sql`
    SELECT
      id, media_url, caption, created_at, expires_at
    FROM stories
    WHERE user_id = ${userId}
    ORDER BY created_at DESC;
  `;

  const now = new Date().toISOString();
  await sql`
    UPDATE users
    SET data_exported_at = ${now}, updated_at = NOW()
    WHERE id = ${userId};
  `;

  return {
    meta: {
      app: "Tribo",
      version: "1.0",
      export_date: now,
      account_id: user.id,
      username: user.username,
      account_created_at: user.created_at
    },
    account: {
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      bio: user.bio || null,
      avatar_url: user.avatar_url || null,
      banner_url: user.banner || null,
      badge_type: user.badge_type || "NONE",
      email_verified: Boolean(user.email_verified || user.verified),
      is_private: Boolean(user.is_private || user.private_account),
      show_online_status: Boolean(user.show_online_status),
      read_receipts: Boolean(user.read_receipts),
      status: user.status,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      data_exported_at: now
    },
    connections: {
      followers_count: followers.length,
      followers: followers.map((f) => ({
        id: f.id,
        username: f.username,
        name: f.name,
        avatar_url: f.avatar_url,
        followed_at: f.followed_at
      })),
      following_count: following.length,
      following: following.map((f) => ({
        id: f.id,
        username: f.username,
        name: f.name,
        avatar_url: f.avatar_url,
        followed_at: f.followed_at
      }))
    },
    chat_history: {
      total_messages: messages.length,
      messages: messages.map((m) => ({
        id: m.id,
        is_sender: m.sender_id === userId,
        sender: { id: m.sender_id, username: m.sender_username, name: m.sender_name },
        receiver: { id: m.receiver_id, username: m.receiver_username, name: m.receiver_name },
        content: m.content,
        media_url: m.media_url,
        audio_url: m.audio_url,
        created_at: m.created_at
      }))
    },
    posts: {
      total_posts: posts.length,
      items: posts
    },
    comments: {
      total_comments: comments.length,
      items: comments
    },
    likes: {
      total_likes: likes.length,
      items: likes
    },
    stories: {
      total_stories: stories.length,
      items: stories
    }
  };
}

module.exports = {
  generateUserDataExport
};