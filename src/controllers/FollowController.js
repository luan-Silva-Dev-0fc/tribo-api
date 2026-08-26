const followModel = require("../models/followModel");
const userModel = require("../models/userModel");
const { getBlockedUserIds } = require("../models/blockModel");

function notFound(res, message = "Seguimento não encontrado") {
  return res.status(404).json({ message });
}

function forbidden(res, message = "Sem permissão para esta operação") {
  return res.status(403).json({ message });
}

async function listFollows(req, res, next) {
  try {
    return res.status(200).json(await followModel.getAllFollows(req.query));
  } catch (error) {
    next(error);
  }
}

async function getFollowById(req, res, next) {
  try {
    const item = await followModel.getFollowById(req.params.id);
    return item ? res.status(200).json(item) : notFound(res);
  } catch (error) {
    next(error);
  }
}

async function createFollow(req, res, next) {
  try {
    const targetUserId = req.params.id || req.body.followingId || req.body.following_id || req.body.userId || req.body.id;
    const requesterId = req.user.id || req.user.sub;

    if (!targetUserId || targetUserId === requesterId) {
      return res.status(400).json({ message: "Não é possível seguir a si mesmo" });
    }

    const [targetUser, blockedIds] = await Promise.all([
    userModel.getUserById(targetUserId, null),
    getBlockedUserIds(requesterId)]
    );

    if (!targetUser || targetUser.status === "BANNED") {
      return res.status(404).json({ message: "Usuário não encontrado ou inativo" });
    }

    if (blockedIds.has(targetUserId)) {
      return res.status(403).json({ message: "Não é possível seguir este usuário devido a um bloqueio ativo" });
    }

    const existingFollow = await followModel.findFollow(requesterId, targetUserId);
    if (existingFollow) {
      if (existingFollow.status === "ACCEPTED" || existingFollow.status === "PENDING") {
        await followModel.deleteFollow(existingFollow.id);
        const updatedTargetUser = await userModel.getUserById(targetUserId, requesterId);
        return res.status(200).json({
          message: "Deixou de seguir o usuário com sucesso (Toggle)",
          status: "NONE",
          followStatus: "NONE",
          followersCount: updatedTargetUser ? updatedTargetUser.followers_count : 0,
          followingCount: updatedTargetUser ? updatedTargetUser.following_count : 0
        });
      }
    }

    const isPrivate = Boolean(targetUser.is_private);
    const initialStatus = isPrivate ? "PENDING" : "ACCEPTED";

    const follow = await followModel.createFollow({
      follower_id: requesterId,
      following_id: targetUserId,
      status: initialStatus
    });

    const updatedTargetUser = await userModel.getUserById(targetUserId, requesterId);
    const requesterName = req.user.name || req.user.username || "Alguém";

    try {
      const { sendPushNotification } = require("../services/pushNotification");
      if (isPrivate) {
        sendPushNotification({
          userId: targetUserId,
          title: "Nova Solicitação",
          body: `${requesterName} enviou uma solicitação para você.`,
          data: {
            type: "request",
            requesterId: String(requesterId),
            followId: String(follow.id)
          }
        }).catch((err) => console.warn("[Push Error Request]", err.message));
      } else {
        sendPushNotification({
          userId: targetUserId,
          title: "Novo Seguidor",
          body: `${requesterName} começou a seguir você.`,
          data: {
            type: "follow",
            requesterId: String(requesterId),
            followId: String(follow.id)
          }
        }).catch((err) => console.warn("[Push Error Follow]", err.message));
      }
    } catch (pushErr) {
      console.warn("[Push Trigger Error]", pushErr.message);
    }

    if (isPrivate) {
      return res.status(201).json({
        message: "Solicitação para seguir enviada com sucesso",
        status: "PENDING",
        followStatus: "PENDING",
        follow,
        followersCount: updatedTargetUser ? updatedTargetUser.followers_count : 0,
        followingCount: updatedTargetUser ? updatedTargetUser.following_count : 0
      });
    }

    return res.status(201).json({
      message: "Seguindo usuário com sucesso",
      status: "ACCEPTED",
      followStatus: "ACCEPTED",
      follow,
      followersCount: updatedTargetUser ? updatedTargetUser.followers_count : 0,
      followingCount: updatedTargetUser ? updatedTargetUser.following_count : 0
    });
  } catch (error) {
    next(error);
  }
}

async function unfollowUser(req, res, next) {
  try {
    const targetUserId = req.params.id || req.body.followingId || req.body.userId;
    const requesterId = req.user.id || req.user.sub;

    if (!targetUserId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    let follow = await followModel.findFollow(requesterId, targetUserId);
    if (!follow) {
      const byId = await followModel.getFollowById(targetUserId);
      if (byId && (byId.follower_id === requesterId || byId.following_id === requesterId)) {
        follow = byId;
      }
    }

    if (!follow) {
      return res.status(404).json({ message: "Você não segue este usuário" });
    }

    await followModel.deleteFollow(follow.id);
    const updatedTargetUser = await userModel.getUserById(targetUserId, requesterId);

    return res.status(200).json({
      message: "Deixou de seguir o usuário com sucesso",
      status: "NONE",
      followStatus: "NONE",
      followersCount: updatedTargetUser ? updatedTargetUser.followers_count : 0,
      followingCount: updatedTargetUser ? updatedTargetUser.following_count : 0
    });
  } catch (error) {
    next(error);
  }
}

async function listFollowRequests(req, res, next) {
  try {
    const requesterId = req.user.id || req.user.sub;
    const requests = await followModel.getFollowRequests(requesterId);
    return res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
}

async function acceptFollowRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const requesterId = req.user.id || req.user.sub;
    const follow = await followModel.acceptFollowRequest(requestId, requesterId);
    if (!follow) {
      return notFound(res, "Solicitação de seguidor não encontrada");
    }

    try {
      const { sendPushNotification } = require("../services/pushNotification");
      const accepterName = req.user.name || req.user.username || "Alguém";
      sendPushNotification({
        userId: follow.follower_id,
        title: "Solicitação Aceita",
        body: `${accepterName} aceitou sua solicitação para seguir.`,
        data: {
          type: "request_accepted",
          userId: String(requesterId),
          followId: String(follow.id)
        }
      }).catch((err) => console.warn("[Push Error Accept]", err.message));
    } catch (pushErr) {
      console.warn("[Push Trigger Error]", pushErr.message);
    }

    return res.status(200).json({
      message: "Solicitação de seguidor aceita com sucesso",
      status: "ACCEPTED",
      follow
    });
  } catch (error) {
    next(error);
  }
}

async function rejectFollowRequest(req, res, next) {
  try {
    const requestId = req.params.id;
    const requesterId = req.user.id || req.user.sub;
    const success = await followModel.rejectFollowRequest(requestId, requesterId);
    if (!success) {
      return notFound(res, "Solicitação de seguidor não encontrada");
    }
    return res.status(200).json({
      message: "Solicitação de seguidor rejeitada com sucesso"
    });
  } catch (error) {
    next(error);
  }
}

async function listFollowers(req, res, next) {
  try {
    const requesterId = req.user ? req.user.id || req.user.sub : null;
    const targetUserId = req.params.id || requesterId;

    if (!targetUserId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    const [targetUser, blockedIds] = await Promise.all([
    userModel.getUserById(targetUserId, requesterId),
    requesterId ? getBlockedUserIds(requesterId) : Promise.resolve(new Set())]
    );

    if (!targetUser || targetUser.status === "BANNED" || requesterId && blockedIds.has(targetUserId)) {
      return notFound(res, "Usuário não encontrado");
    }

    if (targetUser.is_private && requesterId !== targetUserId) {
      const isAllowed = requesterId ? await followModel.isFollowingAccepted(requesterId, targetUserId) : false;
      if (!isAllowed) {
        return forbidden(res, "Este perfil é privado. Siga para ver os seguidores.");
      }
    }

    const followers = await followModel.getFollowers(targetUserId);
    const loyalFollowers = followers.filter((f) => f.is_loyal_follower);

    return res.status(200).json({
      total: followers.length,
      loyal_total: loyalFollowers.length,
      followers
    });
  } catch (error) {
    next(error);
  }
}

async function listFollowing(req, res, next) {
  try {
    const requesterId = req.user ? req.user.id || req.user.sub : null;
    const targetUserId = req.params.id || requesterId;

    if (!targetUserId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    const [targetUser, blockedIds] = await Promise.all([
    userModel.getUserById(targetUserId, requesterId),
    requesterId ? getBlockedUserIds(requesterId) : Promise.resolve(new Set())]
    );

    if (!targetUser || targetUser.status === "BANNED" || requesterId && blockedIds.has(targetUserId)) {
      return notFound(res, "Usuário não encontrado");
    }

    if (targetUser.is_private && requesterId !== targetUserId) {
      const isAllowed = requesterId ? await followModel.isFollowingAccepted(requesterId, targetUserId) : false;
      if (!isAllowed) {
        return forbidden(res, "Este perfil é privado. Siga para ver quem este usuário segue.");
      }
    }

    const following = await followModel.getFollowing(targetUserId);

    return res.status(200).json({
      total: following.length,
      following
    });
  } catch (error) {
    next(error);
  }
}

async function updateFollow(req, res, next) {
  try {
    const requesterId = req.user.id || req.user.sub;
    const follow = await followModel.getFollowById(req.params.id);
    if (!follow) return notFound(res);
    if (follow.follower_id !== requesterId) return forbidden(res);
    const { followingId } = req.body;
    if (!followingId || followingId === requesterId) {
      return res.status(400).json({ message: "followingId deve ser outro usuário" });
    }
    return res.status(200).json(
      await followModel.updateFollow(req.params.id, { following_id: followingId })
    );
  } catch (error) {
    next(error);
  }
}

async function deleteFollow(req, res, next) {
  try {
    const requesterId = req.user.id || req.user.sub;
    const follow = await followModel.getFollowById(req.params.id);
    if (!follow) return notFound(res);
    if (follow.follower_id !== requesterId) return forbidden(res);
    await followModel.deleteFollow(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listFollows,
  getFollowById,
  createFollow,
  unfollowUser,
  listFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  listFollowers,
  listFollowing,
  updateFollow,
  deleteFollow
};