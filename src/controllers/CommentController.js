const commentModel = require("../models/commentModel");
const postModel = require("../models/postModel");
const { sendPushNotification } = require("../services/pushNotification");

function notFound(res) {
  return res.status(404).json({ message: "Comentário não encontrado" });
}
function forbidden(res) {
  return res.status(403).json({ message: "Sem permissão para esta operação" });
}

async function listComments(req, res, next) {
  try {
    const postId = req.query.postId || req.query.post_id;
    return res.
    status(200).
    json(await commentModel.getAllComments(postId));
  } catch (error) {
    next(error);
  }
}

async function getCommentById(req, res, next) {
  try {
    const item = await commentModel.getCommentById(req.params.id);
    return item ? res.status(200).json(item) : notFound(res);
  } catch (error) {
    next(error);
  }
}

async function createComment(req, res, next) {
  try {
    const content = req.body.content || req.body.text || req.body.comment;
    const postId = req.body.postId || req.body.post_id;
    const parentId = req.body.parentId || req.body.parent_id;
    const audioUrl = req.body.audioUrl || req.body.audio_url;

    if (!postId) {
      return res.status(400).json({ message: "O campo postId é obrigatório." });
    }

    if ((!content || !String(content).trim()) && !audioUrl) {
      return res.status(400).json({ message: "Conteúdo ou áudio é obrigatório." });
    }

    let parent = null;
    if (parentId) {
      parent = await commentModel.getCommentById(parentId);
      if (!parent)
      return res.
      status(404).
      json({ message: "Comentário original não encontrado" });
      if (parent.post_id !== postId)
      return res.
      status(400).
      json({ message: "A resposta deve pertencer ao mesmo post" });
    }

    const comment = await commentModel.createComment({
      content: content ? String(content).trim() : null,
      post_id: postId,
      author_id: req.user.sub,
      parent_id: parentId || null,
      audio_url: audioUrl || null
    });

    try {
      const actorName = req.user.name || req.user.username || "Alguém";
      const cleanContent = String(content).trim();
      const commentSnippet = cleanContent.length > 60 ? cleanContent.slice(0, 57) + "..." : cleanContent;

      postModel.getPostById(postId).then((post) => {
        const postAuthorId = post?.author_id || post?.user_id || post?.author && post?.author.id;
        const notificationModel = require("../models/notificationModel");

        if (postAuthorId && postAuthorId !== req.user.sub) {
          const msg = `@${req.user?.username || actorName} comentou no seu post: "${commentSnippet}"`;
          notificationModel.createNotification({
            user_id: postAuthorId,
            actor_id: req.user.sub,
            post_id: postId,
            comment_id: comment.id,
            type: "COMMENT",
            message: msg
          }).catch((err) => console.warn("Erro criacao notif comment post", err));

          sendPushNotification({
            userId: postAuthorId,
            title: "Novo comentário",
            body: msg,
            data: {
              type: "post_comment",
              postId: String(postId),
              commentId: String(comment.id),
              actorId: String(req.user.sub)
            }
          }).catch((err) => console.warn("[Push Error Comment Post]", err.message));
        }

        if (parent) {
          const parentAuthorId = parent.author_id || parent.user_id || parent.author && parent.author.id;
          if (parentAuthorId && parentAuthorId !== req.user.sub && parentAuthorId !== postAuthorId) {
            const msg = `@${req.user?.username || actorName} respondeu seu comentário: "${commentSnippet}"`;
            notificationModel.createNotification({
              user_id: parentAuthorId,
              actor_id: req.user.sub,
              post_id: postId,
              comment_id: comment.id,
              type: "COMMENT",
              message: msg
            }).catch((err) => console.warn("Erro criacao notif comment reply", err));

            sendPushNotification({
              userId: parentAuthorId,
              title: "Nova resposta",
              body: msg,
              data: {
                type: "comment_reply",
                postId: String(postId),
                commentId: String(comment.id),
                parentCommentId: String(parentId),
                actorId: String(req.user.sub)
              }
            }).catch((err) => console.warn("[Push Error Comment Reply]", err.message));
          }
        }
      }).catch(() => {});
    } catch (pushErr) {
      console.warn("[Push Trigger Error]", pushErr.message);
    }

    return res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

async function updateComment(req, res, next) {
  try {
    const comment = await commentModel.getCommentById(req.params.id);
    if (!comment) return notFound(res);
    if (comment.author_id !== req.user.sub) return forbidden(res);
    const updated = await commentModel.updateComment(req.params.id, {
      content: req.body.content
    });
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

async function deleteComment(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.sub;
    const comment = await commentModel.getCommentById(req.params.id);
    if (!comment) return notFound(res);

    const commentAuthorId = comment.author_id || comment.user_id || comment.author && comment.author.id;
    const isCommentAuthor = String(commentAuthorId) === String(userId);

    let isPostAuthor = false;
    if (comment.post_id) {
      try {
        const post = await postModel.getPostById(comment.post_id);
        const postAuthorId = post?.author_id || post?.user_id || post?.author && post?.author.id;
        isPostAuthor = postAuthorId && String(postAuthorId) === String(userId);
      } catch (postErr) {

      }
    }

    const isAdmin = req.user?.role === "ADMIN";

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) return forbidden(res);

    await commentModel.deleteComment(req.params.id);
    return res.status(200).json({ success: true, message: "Comentário excluído com sucesso" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment
};