const groupModel = require('../models/groupModel');
const groqAiService = require('../services/groqAiService');
const { moderarMidia } = require('../services/moderacao');

async function createGroup(req, res, next) {
  try {
    const { name, description, avatarUrl, rules } = req.body;
    const userId = req.user?.id || req.userId;

    if (!name) return res.status(400).json({ success: false, message: 'Nome do grupo é obrigatório.' });

    const group = await groupModel.createGroup(name, description, avatarUrl, rules, userId);
    return res.status(201).json({ success: true, group });
  } catch (err) {
    next(err);
  }
}

async function listMyGroups(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const groups = await groupModel.getUserGroups(userId);
    return res.status(200).json({ success: true, groups });
  } catch (err) {
    next(err);
  }
}

async function getGroupDetails(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(id, userId);
    const group = await groupModel.getGroupById(id);
    if (!group) return res.status(404).json({ success: false, message: 'Grupo não encontrado.' });

    const isMuted = await groupModel.isGroupNotificationMuted(id, userId);
    return res.status(200).json({ success: true, group, role: isMember.role, is_muted: isMuted, isMuted });
  } catch (err) {
    next(err);
  }
}

async function updateGroup(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, avatarUrl, avatar_url, avatar, rules } = req.body;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(id, userId);
    const roleUpper = (isMember?.role || '').toUpperCase();
    const isAdm = isMember && (roleUpper === 'ADMIN' || roleUpper === 'OWNER' || roleUpper === 'CRIADOR');
    if (!isAdm) {
      return res.status(403).json({ success: false, message: 'Apenas admins podem editar o grupo.' });
    }

    const resolvedAvatar = avatarUrl !== undefined ? avatarUrl : avatar_url !== undefined ? avatar_url : avatar;
    const group = await groupModel.updateGroup(id, name, description, resolvedAvatar, rules);
    return res.status(200).json({ success: true, group });
  } catch (err) {
    next(err);
  }
}

async function deleteGroup(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(id, userId);
    if (!isMember || isMember.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem deletar o grupo.' });
    }

    await groupModel.deleteGroup(id);
    return res.status(200).json({ success: true, message: 'Grupo deletado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const { targetUserId } = req.body;
    const userId = req.user?.id || req.userId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'O ID do usuário a ser adicionado (targetUserId) é obrigatório no corpo da requisição.' });
    }

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember || isMember.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem adicionar membros.' });
    }

    const isBanned = await groupModel.isUserBanned(groupId, targetUserId);
    if (isBanned) {
      return res.status(403).json({ success: false, message: 'Este usuário está banido desta tribo e não pode ser adicionado.' });
    }

    const targetAlreadyMember = await groupModel.isGroupMember(groupId, targetUserId);
    if (targetAlreadyMember) {
      return res.status(400).json({ success: false, message: 'O usuário já é membro deste grupo.' });
    }

    const isMutual = await groupModel.checkMutualFollow(userId, targetUserId);
    if (!isMutual) {
      return res.status(403).json({ success: false, message: 'Você só pode adicionar pessoas que você segue e que seguem você de volta.' });
    }

    const member = await groupModel.addGroupMember(groupId, targetUserId, 'MEMBER');
    return res.status(200).json({ success: true, member, message: 'Membro adicionado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const adminId = req.user?.id || req.userId;
    const { reason } = req.body || {};

    const isAdmin = await groupModel.isGroupMember(groupId, adminId);
    if (!isAdmin || isAdmin.role !== 'ADMIN' && isAdmin.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem remover membros.' });
    }

    const targetUser = await groupModel.isGroupMember(groupId, targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuário não é membro deste grupo.' });
    }

    if (targetUser.role === 'ADMIN' || targetUser.role === 'owner') {
      return res.status(403).json({ success: false, message: 'Você não pode remover outro administrador.' });
    }

    await groupModel.removeGroupMember(groupId, targetUserId);
    return res.status(200).json({ success: true, message: 'Membro removido da tribo.' });
  } catch (err) {
    next(err);
  }
}

async function banMember(req, res, next) {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const adminId = req.user?.id || req.userId;

    const isAdmin = await groupModel.isGroupMember(groupId, adminId);
    if (!isAdmin || isAdmin.role !== 'ADMIN' && isAdmin.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem banir membros.' });
    }

    if (String(adminId) === String(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Você não pode banir a si mesmo.' });
    }

    const targetUser = await groupModel.isGroupMember(groupId, targetUserId);
    if (targetUser && (targetUser.role === 'ADMIN' || targetUser.role === 'owner')) {
      return res.status(403).json({ success: false, message: 'Você não pode banir outro administrador.' });
    }

    await groupModel.banGroupMember(groupId, targetUserId, adminId, reason);
    return res.status(200).json({ success: true, message: 'Membro banido da tribo com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function unbanMember(req, res, next) {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const adminId = req.user?.id || req.userId;

    const isAdmin = await groupModel.isGroupMember(groupId, adminId);
    if (!isAdmin || isAdmin.role !== 'ADMIN' && isAdmin.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem desbanir membros.' });
    }

    await groupModel.unbanGroupMember(groupId, targetUserId);
    return res.status(200).json({ success: true, message: 'Membro desbanido com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function listBannedMembers(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember || isMember.role !== 'ADMIN' && isMember.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Apenas admins podem ver a lista de banidos.' });
    }

    const banned = await groupModel.getBannedMembers(groupId);
    return res.status(200).json({ success: true, banned });
  } catch (err) {
    next(err);
  }
}

async function toggleMuteGroup(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;
    const { muted } = req.body;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Você não é membro deste grupo.' });
    }

    let nextMuted;
    if (typeof muted === 'boolean') {
      nextMuted = muted;
    } else {
      const current = await groupModel.isGroupNotificationMuted(groupId, userId);
      nextMuted = !current;
    }

    const setting = await groupModel.setGroupNotificationMuted(groupId, userId, nextMuted);
    return res.status(200).json({
      success: true,
      muted: setting.muted,
      is_muted: setting.muted,
      isMuted: setting.muted,
      message: setting.muted ? 'Notificações da tribo silenciadas.' : 'Notificações da tribo ativadas.'
    });
  } catch (err) {
    next(err);
  }
}

async function getNotificationSettings(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Você não é membro deste grupo.' });
    }

    const muted = await groupModel.isGroupNotificationMuted(groupId, userId);
    return res.status(200).json({ success: true, muted, is_muted: muted, isMuted: muted });
  } catch (err) {
    next(err);
  }
}

async function listMembers(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Apenas membros podem ver a lista de membros.' });
    }

    const members = await groupModel.getGroupMembers(groupId);
    return res.status(200).json({ success: true, members });
  } catch (err) {
    next(err);
  }
}

async function leaveGroup(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;
    const { newAdminId } = req.body;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Você não é membro deste grupo.' });
    }

    if (isMember.role === 'ADMIN') {
      const allMembers = await groupModel.getGroupMembers(groupId);
      const admins = allMembers.filter((m) => m.role === 'ADMIN');

      if (admins.length === 1 && String(admins[0].id) === String(userId)) {
        if (newAdminId) {
          const targetMember = allMembers.find((m) => String(m.id) === String(newAdminId));
          if (!targetMember) {
            return res.status(400).json({ success: false, message: 'O usuário indicado para novo admin não é membro do grupo.' });
          }
          await groupModel.addGroupMember(groupId, newAdminId, 'ADMIN');
          await groupModel.removeGroupMember(groupId, userId);
          return res.status(200).json({ success: true, message: 'Você passou o cargo de admin e saiu do grupo.' });
        } else {
          await groupModel.deleteGroup(groupId);
          return res.status(200).json({ success: true, message: 'Você saiu do grupo e, por ser o último admin, o grupo foi excluído.' });
        }
      }
    }

    await groupModel.removeGroupMember(groupId, userId);
    return res.status(200).json({ success: true, message: 'Você saiu do grupo.' });
  } catch (err) {
    next(err);
  }
}

async function reportGroup(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.userId;

    if (!reason) return res.status(400).json({ success: false, message: 'Motivo obrigatório.' });

    await groupModel.reportGroup(groupId, userId, reason);
    return res.status(200).json({ success: true, message: 'Grupo denunciado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function getFeed(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const limit = parseInt(req.query.limit, 10) || 20;
    const feed = await groupModel.getGroupFeed(groupId, userId, limit);
    return res.status(200).json({ success: true, feed });
  } catch (err) {
    next(err);
  }
}

async function createFeedPost(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const { content, mediaUrl, audioUrl, imageUrl, videoUrl, is_nsfw } = req.body;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const [userRecord] = await sql`
      SELECT allow_nsfw_content FROM users WHERE id = ${userId} LIMIT 1
    `;
    const userAllowsNsfw = Boolean(userRecord?.allow_nsfw_content);

    let shouldMarkAsNsfw = false;
    const resolvedMedia = mediaUrl || imageUrl || videoUrl;
    if (resolvedMedia) {
      const moderation = await moderarMidia(resolvedMedia);
      if (!moderation.aprovado) {
        return res.status(400).json({
          success: false,
          error_code: moderation.motivo || "VIOLENCIA_DETECTADA",
          message: moderation.mensagem || moderation.erro || "Publicação bloqueada por conter violência explícita."
        });
      }

      if (moderation.isNSFW) {
        if (!userAllowsNsfw) {
          return res.status(400).json({
            success: false,
            error_code: "NSFW_CONFIG_DISABLED",
            message: "Este conteúdo contém teor adulto/sexual e não pode ser publicado porque a opção +18 está desativada na sua conta. Nossa plataforma segue artigos rígidos de conformidade digital e determinações judiciais. Para publicar este tipo de conteúdo, ative a opção +18 nas Configurações do seu Perfil."
          });
        }
        shouldMarkAsNsfw = true;
      }
    }

    const post = await groupModel.createGroupPost(groupId, userId, content, resolvedMedia, audioUrl, shouldMarkAsNsfw);
    return res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
}

async function deleteFeedPost(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;

    const group = await groupModel.getGroupById(groupId);
    if (!group) return res.status(404).json({ success: false, message: 'Grupo não encontrado.' });

    const isAdmin = group.admin_id === userId || group.created_by === userId;

    const { sql } = require('../config/database');
    const [post] = await sql`SELECT * FROM group_posts WHERE id = ${postId} AND group_id = ${groupId}`;
    if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado.' });

    if (!isAdmin && post.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Você não tem permissão para apagar este post.' });
    }

    await groupModel.deleteGroupPost(postId);
    return res.status(200).json({ success: true, message: 'Post apagado com sucesso.' });
  } catch (err) {
    next(err);
  }
}

async function getChat(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const limit = parseInt(req.query.limit, 10) || 50;
    const chat = await groupModel.getGroupChat(groupId, limit, userId);

    chat.reverse();

    const formattedChat = chat.map((msg) => ({
      ...msg,
      message: msg.content,
      sender_id: msg.user_id,
      senderId: msg.user_id,
      receiver_id: groupId,
      receiverId: groupId,
      group_id: groupId,
      groupId: groupId,
      audioUrl: msg.audio_url || null,
      mediaUrl: msg.media_url || null,
      audio_url: msg.audio_url || null,
      media_url: msg.media_url || null,
      created_at: msg.created_at,
      createdAt: msg.created_at,
      is_read: true,
      isRead: true,
      user: {
        id: msg.user_id,
        name: msg.name,
        username: msg.username,
        avatar_url: msg.user_avatar
      },
      sender: {
        id: msg.user_id,
        name: msg.name,
        username: msg.username,
        avatar_url: msg.user_avatar
      }
    }));

    return res.status(200).json({
      success: true,
      data: formattedChat,
      messages: formattedChat,
      chat: formattedChat
    });
  } catch (err) {
    next(err);
  }
}

async function createChatMessage(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const body = req.body || {};
    const content = body.content !== undefined ? String(body.content) : "";
    const mediaUrl = body.mediaUrl || body.media_url || null;
    const audioUrl = body.audioUrl || body.audio_url || null;
    const storyId = body.storyId || body.story_id || null;
    const mediaType = body.mediaType || body.media_type || (audioUrl ? "AUDIO" : mediaUrl ? "IMAGE" : "TEXT");
    const isViewOnce = Boolean(body.isViewOnce || body.is_view_once);
    const replyToId = body.replyToId || body.reply_to_id || null;
    const stickerId = body.stickerId || body.sticker_id || null;
    const stickerName = body.stickerName || body.sticker_name || null;
    const packName = body.packName || body.pack_name || null;

    const userId = req.user?.id || req.user?.sub || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      await groupModel.addGroupMember(groupId, userId, 'MEMBER').catch(() => {});
    }

    const msg = await groupModel.createGroupMessage(
      groupId,
      userId,
      content,
      mediaUrl,
      audioUrl,
      storyId,
      mediaType,
      isViewOnce
    );

    let [user] = await require('../config/database').sql`
      SELECT id, username, name, avatar_url FROM users WHERE id = ${userId}
    `;

    if (!user && req.user) {
      user = {
        id: req.user.id || userId,
        username: req.user.username || "usuario",
        name: req.user.name || "Membro",
        avatar_url: req.user.avatar_url || null
      };
    }

    const formattedMessage = {
      ...msg,
      id: msg.id,
      _id: msg.id,
      content: msg.content,
      message: msg.content,
      sender_id: msg.user_id,
      senderId: msg.user_id,
      userId: msg.user_id,
      user_id: msg.user_id,
      receiver_id: groupId,
      receiverId: groupId,
      group_id: groupId,
      groupId: groupId,
      audioUrl: msg.audio_url || audioUrl || null,
      mediaUrl: msg.media_url || mediaUrl || null,
      audio_url: msg.audio_url || audioUrl || null,
      media_url: msg.media_url || mediaUrl || null,
      media_type: msg.media_type || mediaType || null,
      mediaType: msg.media_type || mediaType || null,
      is_view_once: Boolean(msg.is_view_once),
      isViewOnce: Boolean(msg.is_view_once),
      sticker_id: stickerId,
      sticker_name: stickerName,
      pack_name: packName,
      created_at: msg.created_at,
      createdAt: msg.created_at,
      reply_to_id: replyToId,
      is_read: true,
      isRead: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url
      },
      sender: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url
      }
    };

    return res.status(201).json({
      success: true,
      message: "Mensagem enviada com sucesso",
      data: formattedMessage,
      message_data: formattedMessage,
      direct_message: formattedMessage
    });
  } catch (err) {
    next(err);
  }
}

async function markGroupMediaAsViewed(req, res, next) {
  try {
    const { id: groupId, messageId } = req.params;
    const userId = req.user?.id || req.userId;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const { sql } = require('../config/database');
    await sql`
      UPDATE group_messages
      SET viewed_by_users = array_append(COALESCE(viewed_by_users, '{}'), ${userId}::uuid)
      WHERE id = ${messageId} AND group_id = ${groupId} AND NOT (${userId}::uuid = ANY(COALESCE(viewed_by_users, '{}')))
    `;

    return res.status(200).json({ success: true, message: "Mídia marcada como visualizada" });
  } catch (err) {
    next(err);
  }
}

async function getTrends(req, res, next) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?.id || req.userId;
    const { forceRefresh } = req.query;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    let trends = [];
    if (forceRefresh === 'true') {
      trends = await groqAiService.generateGroupTrends(groupId);
    } else {
      trends = await groupModel.getGroupTrends(groupId);

      if (!trends || trends.length === 0) {
        groqAiService.generateGroupTrends(groupId).catch(console.error);
        trends = [];
      }
    }

    return res.status(200).json({ success: true, trends });
  } catch (err) {
    next(err);
  }
}

async function deleteChatMessage(req, res, next) {
  try {
    const groupId = req.params.id;
    const messageId = req.params.messageId;
    const userId = req.user?.id || req.userId || req.user?.sub;

    if (!groupId || !messageId) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ error: "Você não tem permissão para alterar mensagens deste grupo." });
    }

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

    const { archiveAndDeleteGroupMessage } = require('../services/JudicialArchiveService');

    await archiveAndDeleteGroupMessage({
      messageId,
      userId,
      actionType,
      ipAddress,
      userAgent
    });

    if (isForEveryone) {
      try {
        const io = req.app?.get('io') || global.io;
        if (io) {
          io.to(String(groupId)).emit('group-message-deleted', { messageId, groupId });
          io.to(`group_${groupId}`).emit('group-message-deleted', { messageId, groupId });
          io.to(String(groupId)).emit('message-deleted', { messageId, room: String(groupId), forEveryone: true });
          io.to(`group_${groupId}`).emit('message-deleted', { messageId, room: `group_${groupId}`, forEveryone: true });
        }
      } catch (wsErr) {
        console.warn('Erro ao emitir socket de deleção:', wsErr?.message);
      }
    }

    return res.status(200).json({ success: true, message: isForEveryone ? "Mensagem de grupo apagada para todos" : "Mensagem de grupo apagada para você" });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ message: error.message });
    if (error.status === 403) return res.status(403).json({ message: error.message });
    next(error);
  }
}

async function likePost(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    await groupModel.likeGroupPost(postId, userId);
    return res.status(200).json({ success: true, message: 'Post curtido.' });
  } catch (err) {next(err);}
}

async function unlikePost(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    await groupModel.unlikeGroupPost(postId, userId);
    return res.status(200).json({ success: true, message: 'Post descurtido.' });
  } catch (err) {next(err);}
}

async function savePost(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    await groupModel.saveGroupPost(postId, userId);
    return res.status(200).json({ success: true, message: 'Post salvo.' });
  } catch (err) {next(err);}
}

async function unsavePost(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    await groupModel.unsaveGroupPost(postId, userId);
    return res.status(200).json({ success: true, message: 'Post removido dos salvos.' });
  } catch (err) {next(err);}
}

async function getComments(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const limit = parseInt(req.query.limit, 10) || 50;
    const comments = await groupModel.getGroupPostComments(postId, limit);
    return res.status(200).json({ success: true, comments });
  } catch (err) {next(err);}
}

async function addComment(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const { content, audio_url } = req.body;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const comment = await groupModel.addGroupPostComment(postId, userId, content, audio_url);
    return res.status(201).json({ success: true, comment });
  } catch (err) {next(err);}
}

async function deleteComment(req, res, next) {
  try {
    const { id: groupId, commentId } = req.params;
    const userId = req.user?.id || req.userId || req.user?.sub;

    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const group = await groupModel.getGroupById(groupId);
    const isAdmin = group && (String(group.admin_id) === String(userId) || String(group.created_by) === String(userId));

    const { sql } = require('../config/database');
    const [comment] = await sql`SELECT * FROM group_post_comments WHERE id = ${commentId}`;
    if (!comment) return res.status(404).json({ success: false, message: 'Comentário não encontrado.' });

    if (!isAdmin && String(comment.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Sem permissão.' });
    }

    await groupModel.deleteGroupPostComment(commentId);
    return res.status(200).json({ success: true, message: 'Comentário excluído com sucesso.' });
  } catch (err) {next(err);}
}

async function downloadGroupPostMedia(req, res, next) {
  try {
    const { id: groupId, postId } = req.params;
    const userId = req.user?.id || req.userId;
    const isMember = await groupModel.isGroupMember(groupId, userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    await groupModel.incrementDownloadCount(groupId, postId);

    return res.status(200).json({ success: true, message: 'Contagem de download registrada.' });
  } catch (err) {next(err);}
}

module.exports = {
  createGroup,
  listMyGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  listMembers,
  leaveGroup,
  reportGroup,
  getFeed,
  createFeedPost,
  deleteFeedPost,
  getChat,
  createChatMessage,
  deleteChatMessage,
  markGroupMediaAsViewed,
  getTrends,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getComments,
  addComment,
  deleteComment,
  downloadGroupPostMedia,
  banMember,
  unbanMember,
  listBannedMembers,
  toggleMuteGroup,
  getNotificationSettings
};