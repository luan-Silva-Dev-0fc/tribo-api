const messageModel = require("../models/messageModel");

async function createMessage(req, res, next) {
  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const receiver_id =
    body.receiver_id ||
    body.receiverId ||
    body.recipient_id ||
    body.recipientId ||
    body.userId ||
    body.targetUserId ||
    body.user_id ||
    body.to ||
    body.receiver && body.receiver.id ||
    body.user && body.user.id;

    const rawContent =
    body.content !== undefined ?
    body.content :
    body.message !== undefined ?
    body.message :
    body.text !== undefined ?
    body.text :
    body.body !== undefined ?
    body.body :
    body.msg;

    const story_id = body.story_id || body.storyId || body.story && body.story.id || null;
    const media_url = body.media_url || body.mediaUrl || null;
    const audio_url = body.audio_url || body.audioUrl || body.audio && body.audio.url || null;
    let media_type = body.media_type || body.mediaType || (body.type === "reel_share" ? "REEL_SHARE" : null);
    const is_view_once = Boolean(body.is_view_once || body.isViewOnce);

    let processedContent = rawContent;
    if (body.reel_data || body.type === "reel_share" || media_type === "REEL_SHARE" || media_type === "reel_share") {
      media_type = "REEL_SHARE";
      if (body.reel_data && typeof body.reel_data === "object") {
        processedContent = JSON.stringify(body.reel_data);
      }
    }

    const hasReceiver = Boolean(receiver_id);
    const hasContent =
    processedContent !== undefined &&
    processedContent !== null &&
    String(processedContent).trim().length > 0;
    const hasStory = Boolean(story_id);
    const hasMedia = Boolean(media_url);
    const hasAudio = Boolean(audio_url);
    const isReelShare = media_type === "REEL_SHARE" || media_type === "reel_share";

    if (!hasReceiver) {
      return res.status(400).json({ message: "O campo receiver_id é obrigatório." });
    }

    if (!hasContent && !hasStory && !hasMedia && !hasAudio && !isReelShare) {
      return res.status(400).json({ message: "Envie um texto, áudio, mídia, reel ou story." });
    }

    const textContent = hasContent ?
    typeof processedContent === "string" ?
    processedContent.trim() :
    String(processedContent) :
    "";

    const created = await messageModel.createDirectMessage({
      sender_id: req.user.sub || req.user.id,
      receiver_id,
      content: textContent,
      story_id,
      media_url,
      audio_url,
      media_type,
      is_view_once
    });

    try {
      const { sendPushNotification } = require("../services/pushNotification");
      const senderName = req.user.name || req.user.username || "Tribo";
      let pushBody = textContent;
      if (isReelShare) {
        let reelTitle = "";
        try {
          const parsed = JSON.parse(textContent);
          reelTitle = parsed?.title ? `: "${parsed.title}"` : "";
        } catch (e) {}
        pushBody = `🎬 Compartilhou um Reel com você${reelTitle}`;
      } else if (audio_url) {
        pushBody = "🎤 Enviou uma mensagem de voz";
      } else if (story_id) {
        pushBody = "Respondeu ao seu story";
      } else if (media_url && !hasContent) {
        pushBody = "📷 Enviou uma foto/vídeo";
      }

      sendPushNotification({
        userId: receiver_id,
        title: senderName,
        body: pushBody || "Nova mensagem",
        data: {
          type: "chat",
          senderId: String(req.user.sub || req.user.id),
          messageId: String(created.id)
        }
      }).catch((err) => console.warn("[Push Error Chat]", err.message));
    } catch (pushErr) {
      console.warn("[Push Trigger Error]", pushErr.message);
    }

    try {
      const io = req.app.get("io") || global.io;
      if (io) {
        const senderId = String(req.user.sub || req.user.id);
        const receiverId = String(receiver_id);
        io.to("user_" + receiverId).emit("new_message", created);
        io.to("user_" + receiverId).emit("receive-message", created);
        io.to("user_" + senderId).emit("new_message", created);
        io.to("user_" + senderId).emit("receive-message", created);
        io.emit("direct_message_" + receiverId, created);
        io.emit("direct_message_" + senderId, created);
      }
    } catch (e) {}

    return res.status(201).json({
      message: "Mensagem enviada com sucesso",
      direct_message: created,
      ...created
    });
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function editMessage(req, res, next) {
  try {
    const messageId = req.params.id;
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const rawContent =
    body.content !== undefined ?
    body.content :
    body.message !== undefined ?
    body.message :
    body.text !== undefined ?
    body.text :
    body.body;

    if (rawContent === undefined || rawContent === null || String(rawContent).trim().length === 0) {
      return res.status(400).json({ message: "O campo content é obrigatório para edição." });
    }

    const updated = await messageModel.editDirectMessage(
      messageId,
      req.user.sub || req.user.id,
      String(rawContent).trim()
    );

    return res.status(200).json({
      message: "Mensagem editada com sucesso",
      direct_message: updated,
      ...updated
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function markViewOnceAsViewed(req, res, next) {
  try {
    const messageId = req.params.id;
    const { supabase } = require('../config/database');
    const { error } = await supabase.
    from('messages').
    update({ is_viewed: true }).
    eq('id', messageId).
    eq('receiver_id', req.user.sub || req.user.id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: "Mídia marcada como visualizada" });
  } catch (error) {
    next(error);
  }
}

async function listConversations(req, res, next) {
  try {
    const conversations = await messageModel.getConversations(req.user.sub || req.user.id);
    return res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const targetUserId = req.params.userId || req.params.id;
    const messages = await messageModel.getDirectMessages(req.user.sub || req.user.id, targetUserId);
    return res.status(200).json(messages);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const messageId = req.params.id;
    const currentUserId = req.user.sub || req.user.id;

    if (messageId && messageId !== 'read') {
      const updated = await messageModel.markMessageAsRead(messageId, currentUserId);
      return res.status(200).json({
        message: "Mensagem marcada como lida",
        direct_message: updated
      });
    }

    const body = req.body || {};
    const query = req.query || {};

    const senderId = body.senderId || body.sender_id || body.userId || body.user_id || query.senderId || query.userId;
    const conversationId = body.conversationId || body.conversation_id || query.conversationId;
    const messageIds = body.messageIds || body.message_ids || (body.ids ? [].concat(body.ids) : null);

    const result = await messageModel.markMessagesAsRead({
      userId: currentUserId,
      senderId,
      conversationId,
      messageIds
    });

    return res.status(200).json({
      message: "Mensagens marcadas como lidas",
      ...result
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const messageId = req.params.id;
    const body = req.body || {};
    const query = req.query || {};

    const type = String(body.type || body.deleteType || query.type || query.deleteType || '').toLowerCase();
    const isForEveryone =
    body.forEveryone === true ||
    body.forEveryone === 'true' ||
    query.forEveryone === true ||
    query.forEveryone === 'true' ||
    type === 'everyone' ||
    type === 'for_everyone';

    const actionType = isForEveryone ? 'DELETE_FOR_ALL' : 'DELETE_FOR_ME';

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Desconhecido';

    const { archiveAndDeleteMessage } = require('../services/JudicialArchiveService');
    await archiveAndDeleteMessage({
      messageId,
      userId: req.user.sub || req.user.id,
      actionType,
      ipAddress,
      userAgent
    });

    const result = { success: true, message: isForEveryone ? "Mensagem apagada para todos" : "Mensagem apagada para você" };

    try {
      const io = req.app.get("io") || global.io;
      if (io) {
        io.to("user_" + (req.user.sub || req.user.id)).emit("message-deleted", { messageId, forEveryone: isForEveryone });
        io.emit("message-deleted", { messageId, forEveryone: isForEveryone });
      }
    } catch (e) {}

    return res.status(200).json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
}

async function listMessages(req, res, next) {
  if (req.params.conversation) {
    try {
      const messages = await messageModel.getMessagesByConversation(req.params.conversation);
      return res.status(200).json(messages);
    } catch (error) {
      next(error);
    }
  } else {
    return listConversations(req, res, next);
  }
}

async function getMessageById(req, res, next) {
  try {
    const item = await messageModel.getMessageById(req.params.id);
    if (!item) return res.status(404).json({ message: "Mensagem não encontrada" });
    return res.status(200).json(item);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMessage,
  editMessage,
  listConversations,
  getChatHistory,
  markAsRead,
  deleteMessage,
  markViewOnceAsViewed,
  listMessages,
  getMessageById
};