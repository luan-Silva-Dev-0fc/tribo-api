const { sql } = require("../config/database");
const { isMutualFollow } = require("./followModel");
const { getBlockedUserIds } = require("./blockModel");
const { getUserSettings, updateUserLastSeen, formatUserData } = require("./userModel");
const { deleteFromR2 } = require("../services/cloudflare");

function formatMessageUser(user, viewerSettings = null) {
  if (!user) return null;
  return formatUserData(user, viewerSettings, false);
}

async function createDirectMessage({ sender_id, receiver_id, content, story_id, media_url, audio_url, media_type, is_view_once }) {
  if (!receiver_id) {
    const error = new Error("Destinatário é obrigatório");
    error.status = 400;
    throw error;
  }

  if (sender_id === receiver_id) {
    const error = new Error("Não é possível enviar mensagem para você mesmo");
    error.status = 400;
    throw error;
  }

  const mutual = await isMutualFollow(sender_id, receiver_id);
  if (!mutual) {
    const error = new Error("Vocês precisam se seguir mutuamente para trocar mensagens.");
    error.status = 403;
    throw error;
  }

  const blockedIds = await getBlockedUserIds(sender_id);
  if (blockedIds.has(receiver_id)) {
    const error = new Error("Não é possível enviar mensagem para este usuário.");
    error.status = 403;
    throw error;
  }

  const textContent = content || "";
  const created_at = new Date().toISOString();

  const [message] = await sql`
    INSERT INTO messages (
      sender_id, receiver_id, content, message, story_id, media_url, audio_url,
      media_type, is_view_once,
      created_at, is_edited, is_deleted, deleted_for_everyone, deleted_by_users
    )
    VALUES (
      ${sender_id}, ${receiver_id}, ${textContent}, ${textContent}, ${story_id || null}, ${media_url || null}, ${audio_url || null},
      ${media_type || null}, ${Boolean(is_view_once)},
      ${created_at}, false, false, false, '{}'
    )
    RETURNING id, sender_id, receiver_id, content, message, story_id, media_url, audio_url, media_type, is_view_once, is_viewed, created_at, read_at, is_edited, edited_at, is_deleted, deleted_for_everyone
  `;

  await updateUserLastSeen(sender_id);

  return {
    ...message,
    audio_url: message.audio_url || null,
    audioUrl: message.audio_url || null,
    media_url: message.media_url || null,
    mediaUrl: message.media_url || null,
    media_type: message.media_type || null,
    mediaType: message.media_type || null,
    is_view_once: Boolean(message.is_view_once),
    isViewOnce: Boolean(message.is_view_once),
    is_viewed: Boolean(message.is_viewed),
    isViewed: Boolean(message.is_viewed),
    isEdited: Boolean(message.is_edited),
    is_edited: Boolean(message.is_edited),
    editedAt: message.edited_at,
    edited_at: message.edited_at,
    isDeleted: Boolean(message.is_deleted),
    is_deleted: Boolean(message.is_deleted),
    deletedForEveryone: Boolean(message.deleted_for_everyone),
    deleted_for_everyone: Boolean(message.deleted_for_everyone)
  };
}

async function editDirectMessage(messageId, userId, newContent) {
  if (!messageId) {
    const error = new Error("ID da mensagem é obrigatório");
    error.status = 400;
    throw error;
  }

  if (newContent === undefined || newContent === null || String(newContent).trim().length === 0) {
    const error = new Error("O conteúdo da mensagem não pode ser vazio");
    error.status = 400;
    throw error;
  }

  const [msg] = await sql`
    SELECT id, sender_id, receiver_id, content, is_deleted, deleted_for_everyone, deleted_by_users
    FROM messages
    WHERE id = ${messageId}
  `;

  if (!msg) {
    const error = new Error("Mensagem não encontrada");
    error.status = 404;
    throw error;
  }

  if (msg.sender_id !== userId) {
    const error = new Error("Apenas o autor pode editar esta mensagem");
    error.status = 403;
    throw error;
  }

  if (msg.is_deleted || msg.deleted_for_everyone) {
    const error = new Error("Não é possível editar uma mensagem apagada");
    error.status = 400;
    throw error;
  }

  const text = String(newContent).trim();
  const edited_at = new Date().toISOString();

  const [updated] = await sql`
    UPDATE messages
    SET content = ${text},
        message = ${text},
        is_edited = true,
        edited_at = ${edited_at}
    WHERE id = ${messageId}
    RETURNING id, sender_id, receiver_id, content, message, story_id, media_url, created_at, read_at, is_edited, edited_at, is_deleted, deleted_for_everyone
  `;

  await updateUserLastSeen(userId);

  return {
    ...updated,
    isEdited: true,
    is_edited: true,
    editedAt: updated.edited_at,
    edited_at: updated.edited_at,
    isDeleted: Boolean(updated.is_deleted),
    is_deleted: Boolean(updated.is_deleted),
    deletedForEveryone: Boolean(updated.deleted_for_everyone),
    deleted_for_everyone: Boolean(updated.deleted_for_everyone)
  };
}

async function deleteDirectMessage(messageId, userId, options = {}) {
  if (!messageId) {
    const error = new Error("ID da mensagem é obrigatório");
    error.status = 400;
    throw error;
  }

  const [msg] = await sql`
    SELECT id, sender_id, receiver_id, media_url, audio_url, is_deleted, deleted_for_everyone, deleted_by_users
    FROM messages
    WHERE id = ${messageId}
  `;

  if (!msg) {
    const error = new Error("Mensagem não encontrada");
    error.status = 404;
    throw error;
  }

  const isSender = msg.sender_id === userId;
  const isReceiver = msg.receiver_id === userId;

  if (!isSender && !isReceiver) {
    const error = new Error("Sem permissão para apagar esta mensagem");
    error.status = 403;
    throw error;
  }

  const type = String(options.type || options.deleteType || (options.forEveryone ? 'everyone' : 'me')).toLowerCase();
  const isForEveryone = type === 'everyone' || type === 'for_everyone' || options.forEveryone === true;

  if (isForEveryone) {
    if (!isSender) {
      const error = new Error("Apenas o remetente pode apagar a mensagem para todos");
      error.status = 403;
      throw error;
    }

    const deleted_at = new Date().toISOString();
    const placeholder = "Esta mensagem foi apagada";

    const [updated] = await sql`
      UPDATE messages
      SET content = ${placeholder},
          message = ${placeholder},
          media_url = NULL,
          audio_url = NULL,
          story_id = NULL,
          is_deleted = true,
          deleted_for_everyone = true,
          deleted_at = ${deleted_at}
      WHERE id = ${messageId}
      RETURNING id, sender_id, receiver_id, content, message, is_deleted, deleted_for_everyone, deleted_at
    `;

    await updateUserLastSeen(userId);

    return {
      message: "Mensagem apagada para todos",
      deletedForEveryone: true,
      deleted_for_everyone: true,
      isDeleted: true,
      is_deleted: true,
      direct_message: updated
    };
  } else {

    await sql`
      UPDATE messages
      SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), ${userId}::uuid)
      WHERE id = ${messageId} AND NOT (${userId}::uuid = ANY(COALESCE(deleted_by_users, '{}')))
    `;

    await updateUserLastSeen(userId);

    return {
      message: "Mensagem apagada para você",
      deletedForMe: true,
      deleted_for_me: true,
      id: messageId
    };
  }
}

async function markMessageAsRead(messageId, userId) {
  if (!messageId) {
    const error = new Error("ID da mensagem é obrigatório");
    error.status = 400;
    throw error;
  }

  const read_at = new Date().toISOString();
  const [updated] = await sql`
    UPDATE messages
    SET read_at = ${read_at}
    WHERE id = ${messageId} AND receiver_id = ${userId}
    RETURNING id, sender_id, receiver_id, content, read_at
  `;

  if (!updated) {
    const [msg] = await sql`SELECT id, receiver_id FROM messages WHERE id = ${messageId}`;
    if (!msg) {
      const error = new Error("Mensagem não encontrada");
      error.status = 404;
      throw error;
    }
    if (msg.receiver_id !== userId) {
      const error = new Error("Sem permissão para marcar esta mensagem como lida");
      error.status = 403;
      throw error;
    }
  }

  await updateUserLastSeen(userId);

  return updated;
}

async function markMessagesAsRead({ userId, senderId, conversationId, messageIds }) {
  if (!userId) {
    const error = new Error("Usuário é obrigatório");
    error.status = 400;
    throw error;
  }

  const read_at = new Date().toISOString();
  let updatedRows = [];

  if (Array.isArray(messageIds) && messageIds.length > 0) {
    updatedRows = await sql`
      UPDATE messages
      SET read_at = ${read_at}
      WHERE id = ANY(${messageIds}::uuid[]) AND receiver_id = ${userId} AND read_at IS NULL
      RETURNING id, sender_id, receiver_id, read_at
    `;
  } else if (senderId) {
    updatedRows = await sql`
      UPDATE messages
      SET read_at = ${read_at}
      WHERE sender_id = ${senderId} AND receiver_id = ${userId} AND read_at IS NULL
      RETURNING id, sender_id, receiver_id, read_at
    `;
  } else if (conversationId) {
    updatedRows = await sql`
      UPDATE messages
      SET read_at = ${read_at}
      WHERE conversation_id = ${conversationId} AND receiver_id = ${userId} AND read_at IS NULL
      RETURNING id, sender_id, receiver_id, read_at
    `;
  } else {

    updatedRows = await sql`
      UPDATE messages
      SET read_at = ${read_at}
      WHERE receiver_id = ${userId} AND read_at IS NULL
      RETURNING id, sender_id, receiver_id, read_at
    `;
  }

  await updateUserLastSeen(userId);

  return {
    count: updatedRows.length,
    updated_messages: updatedRows
  };
}

async function getConversations(userId) {
  await updateUserLastSeen(userId);

  const viewerSettings = await getUserSettings(userId);
  const viewerAllowsReceipts = viewerSettings ? viewerSettings.readReceipts !== false : true;

  const messages = await sql`
    SELECT
      m.id, m.sender_id, m.receiver_id, m.content, m.message, m.story_id, m.media_url, m.audio_url,
      m.created_at, m.read_at, m.is_edited, m.edited_at, m.is_deleted, m.deleted_for_everyone,
      u_sender.id as s_id, u_sender.name as s_name, u_sender.username as s_username, u_sender.avatar_url as s_avatar_url,
      u_sender.badge_type as s_badge_type, u_sender.email_verified as s_email_verified, u_sender.is_private as s_is_private,
      u_sender.show_online_status as s_show_online_status, u_sender.read_receipts as s_read_receipts, u_sender.last_seen as s_last_seen,
      u_recv.id as r_id, u_recv.name as r_name, u_recv.username as r_username, u_recv.avatar_url as r_avatar_url,
      u_recv.badge_type as r_badge_type, u_recv.email_verified as r_email_verified, u_recv.is_private as r_is_private,
      u_recv.show_online_status as r_show_online_status, u_recv.read_receipts as r_read_receipts, u_recv.last_seen as r_last_seen
    FROM messages m
    LEFT JOIN users u_sender ON u_sender.id = m.sender_id
    LEFT JOIN users u_recv ON u_recv.id = m.receiver_id
    WHERE (m.sender_id = ${userId} OR m.receiver_id = ${userId})
      AND m.receiver_id IS NOT NULL
      AND NOT (${userId}::uuid = ANY(COALESCE(m.deleted_by_users, '{}')))
    ORDER BY m.created_at DESC
  `;

  const conversationMap = new Map();

  for (const row of messages) {
    const isSender = row.sender_id === userId;
    const contactId = isSender ? row.receiver_id : row.sender_id;

    if (!contactId) continue;

    if (conversationMap.has(contactId)) {
      if (!isSender && !row.read_at && !row.deleted_for_everyone) {
        const conv = conversationMap.get(contactId);
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
      continue;
    }

    const contactRawUser = isSender ?
    {
      id: row.r_id,
      name: row.r_name,
      username: row.r_username,
      avatar_url: row.r_avatar_url,
      badge_type: row.r_badge_type,
      email_verified: row.r_email_verified,
      is_private: row.r_is_private,
      show_online_status: row.r_show_online_status,
      read_receipts: row.r_read_receipts,
      last_seen: row.r_last_seen
    } :
    {
      id: row.s_id,
      name: row.s_name,
      username: row.s_username,
      avatar_url: row.s_avatar_url,
      badge_type: row.s_badge_type,
      email_verified: row.s_email_verified,
      is_private: row.s_is_private,
      show_online_status: row.s_show_online_status,
      read_receipts: row.s_read_receipts,
      last_seen: row.s_last_seen
    };

    const contactUser = formatMessageUser(contactRawUser, viewerSettings);
    const contactAllowsReceipts = contactRawUser.read_receipts !== false;

    let effectiveReadAt = row.read_at;
    if (isSender) {
      if (!viewerAllowsReceipts || !contactAllowsReceipts) {
        effectiveReadAt = null;
      }
    }

    const isUnread = !isSender && !row.read_at && !row.deleted_for_everyone;
    const isDeleted = Boolean(row.deleted_for_everyone || row.is_deleted);
    const textContent = isDeleted ? "Esta mensagem foi apagada" : row.content || row.message;

    conversationMap.set(contactId, {
      contact_id: contactId,
      contact: contactUser,
      last_message: {
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        content: textContent,
        message: textContent,
        story_id: isDeleted ? null : row.story_id,
        media_url: isDeleted ? null : row.media_url,
        mediaUrl: isDeleted ? null : row.media_url,
        audio_url: isDeleted ? null : row.audio_url,
        audioUrl: isDeleted ? null : row.audio_url,
        is_edited: Boolean(row.is_edited),
        isEdited: Boolean(row.is_edited),
        edited_at: row.edited_at,
        editedAt: row.edited_at,
        is_deleted: isDeleted,
        isDeleted: isDeleted,
        deleted_for_everyone: Boolean(row.deleted_for_everyone),
        deletedForEveryone: Boolean(row.deleted_for_everyone),
        created_at: row.created_at,
        createdAt: row.created_at,
        read_at: effectiveReadAt,
        readAt: effectiveReadAt,
        is_read: Boolean(effectiveReadAt),
        isRead: Boolean(effectiveReadAt)
      },
      unread_count: isUnread ? 1 : 0
    });
  }

  return Array.from(conversationMap.values());
}

async function getDirectMessages(userId, targetUserId) {
  await updateUserLastSeen(userId);

  const mutual = await isMutualFollow(userId, targetUserId);
  if (!mutual) {
    const error = new Error("Vocês precisam se seguir mutuamente para trocar mensagens.");
    error.status = 403;
    throw error;
  }

  const [viewerSettings, targetSettings] = await Promise.all([
  getUserSettings(userId),
  getUserSettings(targetUserId)]
  );

  const viewerAllowsReceipts = viewerSettings ? viewerSettings.readReceipts !== false : true;
  const targetAllowsReceipts = targetSettings ? targetSettings.readReceipts !== false : true;

  const rawMessages = await sql`
    SELECT
      m.id, m.sender_id, m.receiver_id, m.content, m.message, m.story_id, m.media_url, m.audio_url,
      m.media_type, m.is_view_once, m.is_viewed,
      m.created_at, m.read_at, m.is_edited, m.edited_at, m.is_deleted, m.deleted_for_everyone,
      s.id as s_id, s.media_url as s_media_url, s.caption as s_caption, s.expires_at as s_expires_at
    FROM messages m
    LEFT JOIN stories s ON s.id = m.story_id
    WHERE ((m.sender_id = ${userId} AND m.receiver_id = ${targetUserId})
       OR  (m.sender_id = ${targetUserId} AND m.receiver_id = ${userId}))
      AND NOT (${userId}::uuid = ANY(COALESCE(m.deleted_by_users, '{}')))
    ORDER BY m.created_at ASC
  `;

  return rawMessages.map((row) => {
    const isSender = row.sender_id === userId;
    const isDeleted = Boolean(row.deleted_for_everyone || row.is_deleted);
    const content = isDeleted ? "Esta mensagem foi apagada" : row.content || row.message;

    let effectiveReadAt = row.read_at;
    if (isSender) {
      if (!viewerAllowsReceipts || !targetAllowsReceipts) {
        effectiveReadAt = null;
      }
    }

    return {
      id: row.id,
      sender_id: row.sender_id,
      senderId: row.sender_id,
      receiver_id: row.receiver_id,
      receiverId: row.receiver_id,
      content: content,
      message: content,
      media_url: isDeleted ? null : row.media_url,
      mediaUrl: isDeleted ? null : row.media_url,
      audio_url: isDeleted ? null : row.audio_url,
      audioUrl: isDeleted ? null : row.audio_url,
      media_type: isDeleted ? null : row.media_type,
      mediaType: isDeleted ? null : row.media_type,
      is_view_once: Boolean(row.is_view_once),
      isViewOnce: Boolean(row.is_view_once),
      is_viewed: Boolean(row.is_viewed),
      isViewed: Boolean(row.is_viewed),
      is_edited: Boolean(row.is_edited),
      isEdited: Boolean(row.is_edited),
      edited_at: row.edited_at,
      editedAt: row.edited_at,
      is_deleted: isDeleted,
      isDeleted: isDeleted,
      deleted_for_everyone: Boolean(row.deleted_for_everyone),
      deletedForEveryone: Boolean(row.deleted_for_everyone),
      created_at: row.created_at,
      createdAt: row.created_at,
      read_at: effectiveReadAt,
      readAt: effectiveReadAt,
      is_read: Boolean(effectiveReadAt),
      isRead: Boolean(effectiveReadAt),
      story_id: isDeleted ? null : row.story_id,
      storyId: isDeleted ? null : row.story_id,
      story: isDeleted || !row.story_id ? null : {
        id: row.s_id,
        media_url: row.s_media_url,
        mediaUrl: row.s_media_url,
        caption: row.s_caption,
        expires_at: row.s_expires_at,
        expiresAt: row.s_expires_at,
        is_expired: row.s_expires_at ? new Date(row.s_expires_at) <= new Date() : false,
        isExpired: row.s_expires_at ? new Date(row.s_expires_at) <= new Date() : false
      }
    };
  });
}

async function getMessagesByConversation(conversation) {
  const messages = await sql`
    SELECT * FROM messages WHERE conversation_id = ${conversation} OR topic = ${conversation} ORDER BY created_at ASC
  `;
  return messages;
}

async function getMessageById(id) {
  const [msg] = await sql`SELECT * FROM messages WHERE id = ${id}`;
  if (!msg) return null;
  return {
    ...msg,
    isEdited: Boolean(msg.is_edited),
    is_edited: Boolean(msg.is_edited),
    isDeleted: Boolean(msg.is_deleted || msg.deleted_for_everyone),
    is_deleted: Boolean(msg.is_deleted || msg.deleted_for_everyone),
    deletedForEveryone: Boolean(msg.deleted_for_everyone),
    deleted_for_everyone: Boolean(msg.deleted_for_everyone)
  };
}

module.exports = {
  createDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  markMessageAsRead,
  markMessagesAsRead,
  getConversations,
  getDirectMessages,
  getMessagesByConversation,
  getMessageById
};