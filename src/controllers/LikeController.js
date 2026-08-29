const likeModel = require("../models/likeModel");
const { sendPushNotification } = require("../services/pushNotification");

function notFound(res, message = "Curtida não encontrada") {
  return res.status(404).json({ message });
}
function forbidden(res, message = "Sem permissão para esta operação") {
  return res.status(403).json({ message });
}

async function listLikes(req, res, next) {
  try {
    const postId = req.query.postId || req.query.post_id;
    const commentId = req.query.commentId || req.query.comment_id;
    const userId = req.query.userId || req.query.user_id;
    return res.status(200).json(await likeModel.getAllLikes({ postId, commentId, userId }));
  } catch (error) {
    next(error);
  }
}

async function getLikeById(req, res, next) {
  try {
    const item = await likeModel.getLikeById(req.params.id);
    return item ? res.status(200).json(item) : notFound(res);
  } catch (error) {
    next(error);
  }
}

async function createLike(req, res, next) {
  try {
    let postId = req.body?.postId || req.body?.post_id;
    let commentId = req.body?.commentId || req.body?.comment_id;

    if (req.params?.id) {
      if (req.baseUrl && req.baseUrl.includes('comment')) {
        commentId = req.params.id;
      } else {
        postId = req.params.id;
      }
    }

    if (!postId && !commentId) {
      const type = req.body?.type || req.body?.targetType;
      const genericId = req.body?.id || req.body?.targetId || req.body?.target_id || req.query?.postId || req.query?.id;

      if (type === 'comment') {
        commentId = genericId;
      } else if (type === 'post') {
        postId = genericId;
      } else if (genericId) {
        postId = genericId;
      }
    }

    const userId = req.user?.id || req.user?.sub;

    if (!postId && !commentId) {
      return res.status(400).json({ message: "Informe postId ou commentId" });
    }

    const result = await likeModel.toggleLike({ userId, postId, commentId });

    try {
      if (result.isLiked) {
        const actorName = req.user?.name || req.user?.username || "Alguém";
        const notificationModel = require("../models/notificationModel");

        if (result.postId && result.postOwnerId && result.postOwnerId !== userId) {
          const msg = `@${req.user?.username || actorName} curtiu sua publicação.`;

          notificationModel.createNotification({
            user_id: result.postOwnerId,
            actor_id: userId,
            post_id: result.postId,
            type: "LIKE",
            message: msg
          }).catch((err) => console.warn("Erro ao criar notificacao de curtida de post", err));

          sendPushNotification({
            userId: result.postOwnerId,
            title: "Nova curtida",
            body: msg,
            data: {
              type: "post_like",
              postId: String(result.postId),
              actorId: String(userId)
            }
          }).catch((err) => console.warn("[Push Error Like Post]", err.message));
        } else if (result.commentId && result.commentOwnerId && result.commentOwnerId !== userId) {
          const msg = `@${req.user?.username || actorName} curtiu seu comentário.`;

          notificationModel.createNotification({
            user_id: result.commentOwnerId,
            actor_id: userId,
            comment_id: result.commentId,
            post_id: result.postId || null,
            type: "LIKE",
            message: msg
          }).catch((err) => console.warn("Erro ao criar notificacao de curtida de comment", err));

          sendPushNotification({
            userId: result.commentOwnerId,
            title: "Nova curtida",
            body: msg,
            data: {
              type: "comment_like",
              commentId: String(result.commentId),
              postId: result.postId ? String(result.postId) : "",
              actorId: String(userId)
            }
          }).catch((err) => console.warn("[Push Error Like Comment]", err.message));
        }
      }
    } catch (pushErr) {
      console.warn("[Push Trigger Error]", pushErr.message);
    }

    return res.status(200).json({
      success: true,
      message: result.isLiked ? "Curtida adicionada com sucesso" : "Curtida removida com sucesso",
      ...result
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Erro interno ao processar like:", error);
    return res.status(500).json({ error: "Erro ao processar curtida", details: error.message });
  }
}

async function updateLike(req, res, next) {
  try {
    const userId = req.user.id || req.user.sub;
    const like = await likeModel.getLikeById(req.params.id);
    if (!like) return notFound(res);
    if (like.user_id !== userId) return forbidden(res);
    const postId = req.body.postId || req.body.post_id;
    const commentId = req.body.commentId || req.body.comment_id;
    if (postId && commentId || !postId && !commentId)
    return res.status(400).json({ message: "Informe postId ou commentId" });
    return res.
    status(200).
    json(
      await likeModel.updateLike(req.params.id, {
        post_id: postId || null,
        comment_id: commentId || null
      })
    );
  } catch (error) {
    next(error);
  }
}

async function deleteLike(req, res, next) {
  try {
    const userId = req.user.id || req.user.sub;
    const like = await likeModel.getLikeById(req.params.id);
    if (!like) return notFound(res);
    if (like.user_id !== userId) return forbidden(res);
    await likeModel.deleteLike(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listLikes, getLikeById, createLike, updateLike, deleteLike };