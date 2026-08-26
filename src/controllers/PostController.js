const postModel = require("../models/postModel");
const repostModel = require("../models/repostModel");
const reportModel = require("../models/reportModel");
const { moderarMidia } = require("../services/moderacao");
const { deleteFromR2 } = require("../services/cloudflare");
const { sql } = require("../config/database");

function getYouTubeId(url) {
  if (!url || typeof url !== "string") return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.trim().match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function forbidden(res) {
  return res.status(403).json({ message: "Sem permissão para esta operação" });
}

async function listPosts(req, res, next) {
  try {
    const viewerId = req.user?.sub || req.user?.id || req.userId;
    const posts = await postModel.getAllPosts(viewerId);
    return res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
}

async function getPostById(req, res, next) {
  try {
    const viewerId = req.user?.sub || req.user?.id || req.userId;
    const post = await postModel.getPostById(req.params.id, viewerId);
    if (!post) {
      return res.status(404).json({ message: "Post não encontrado" });
    }

    return res.status(200).json(post);
  } catch (error) {
    next(error);
  }
}

async function createPost(req, res, next) {
  try {
    const authorId = req.user?.sub || req.user?.id || req.userId;

    const [userRecord] = await sql`
      SELECT allow_nsfw_content FROM users WHERE id = ${authorId} LIMIT 1
    `;
    const userAllowsNsfw = Boolean(userRecord?.allow_nsfw_content);

    const {
      content,
      imageUrl,
      videoUrl,
      audioUrl,
      audio_url,
      mediaUrl,
      youtube_url,
      youtubeUrl,
      type,
      repost_post_id,
      media_attachments
    } = req.body || {};

    let shouldMarkAsNsfw = false;

    const rawYoutubeUrl = youtube_url || youtubeUrl || (type === "youtube" ? mediaUrl || content : null);
    const resolvedYoutubeId = rawYoutubeUrl ?
    getYouTubeId(rawYoutubeUrl) :
    content ? getYouTubeId(content) : null;
    const resolvedYoutubeUrl = resolvedYoutubeId ?
    rawYoutubeUrl || `https://www.youtube.com/watch?v=${resolvedYoutubeId}` :
    null;

    const resolvedImage = imageUrl || (mediaUrl && !audioUrl && !audio_url && !resolvedYoutubeId ? mediaUrl : null);
    const resolvedVideo = videoUrl || null;
    const resolvedAudio = audioUrl || audio_url || null;
    const resolvedAttachments = Array.isArray(media_attachments) ? media_attachments : [];
    const mediaFile = req.file || req.files && req.files[0] || null;

    const mediaType = resolvedYoutubeId ?
    "youtube" :
    resolvedVideo ? "video" : resolvedAudio ? "audio" : resolvedImage ? "image" : null;

    const mediaItemsToModerate = [];
    if (mediaFile) mediaItemsToModerate.push(mediaFile);
    if (resolvedImage) mediaItemsToModerate.push(resolvedImage);
    if (resolvedVideo) mediaItemsToModerate.push(resolvedVideo);
    resolvedAttachments.forEach((att) => {
      const u = typeof att === "string" ? att : att?.url || att?.uri || att?.mediaUrl || att?.media_url;
      if (u && !mediaItemsToModerate.includes(u)) {
        mediaItemsToModerate.push(u);
      }
    });

    for (const item of mediaItemsToModerate) {
      const moderation = await moderarMidia(item);

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

    const post = await postModel.createPost({
      content: content || null,
      image_url: resolvedImage,
      video_url: resolvedVideo,
      audio_url: resolvedAudio,
      youtube_url: resolvedYoutubeUrl,
      youtube_video_id: resolvedYoutubeId,
      media_type: mediaType,
      media_attachments: resolvedAttachments,
      author_id: authorId,
      is_nsfw: shouldMarkAsNsfw,
      repost_post_id: repost_post_id || null
    });

    if (repost_post_id) {
      try {
        const targetPost = await postModel.getPostById(repost_post_id);
        const postAuthorId = targetPost?.author_id || targetPost?.user_id || targetPost?.author && targetPost?.author.id;

        if (postAuthorId && String(postAuthorId) !== String(authorId)) {
          const { sendPushNotification } = require("../services/pushNotification");
          const notificationModel = require("../models/notificationModel");
          const actorName = req.user?.name || req.user?.username || "Alguém";
          const msg = `@${req.user?.username || actorName} repostou sua publicação.`;

          notificationModel.createNotification({
            user_id: postAuthorId,
            message: msg
          }).catch((err) => console.warn("Erro notif repost", err));

          sendPushNotification({
            userId: postAuthorId,
            title: "Novo Repost",
            body: msg,
            data: {
              type: "post_repost",
              postId: String(repost_post_id),
              actorId: String(authorId)
            }
          }).catch((err) => console.warn("[Push Error Repost]", err.message));
        }
      } catch (err) {
        console.warn("Erro ao gerar notificacao de repost:", err);
      }
    }

    return res.status(201).json(post);
  } catch (err) {
    console.error("[ERRO CREATE POST]:", err);
    return res.status(500).json({ success: false, message: err?.message || "Erro ao criar publicação." });
  }
}

async function updatePost(req, res, next) {
  try {
    const existing = await postModel.getPostById(req.params.id, req.user.sub);
    if (!existing)
    return res.status(404).json({ message: "Post não encontrado" });
    const authorId = existing.author_id || existing.user_id || existing.author && existing.author.id;
    if (authorId !== req.user.sub) return forbidden(res);

    const { content, imageUrl, videoUrl, audioUrl, audio_url } = req.body;
    const post = await postModel.updatePost(req.params.id, {
      content,
      image_url: imageUrl !== undefined ? imageUrl : existing.image_url,
      video_url: videoUrl !== undefined ? videoUrl : existing.video_url,
      audio_url: audioUrl !== undefined ? audioUrl : audio_url !== undefined ? audio_url : existing.audio_url,
      updated_at: new Date().toISOString()
    });
    return res.status(200).json(post);
  } catch (error) {
    next(error);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id, req.user.sub);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });
    const authorId = post.author_id || post.user_id || post.author && post.author.id;
    if (authorId !== req.user.sub) return forbidden(res);

    await postModel.deletePost(req.params.id);
    return res.status(200).json({ message: "Post arquivado com sucesso" });
  } catch (error) {
    next(error);
  }
}

async function listReposts(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });
    return res.status(200).json(await repostModel.getRepostsByPost(req.params.id));
  } catch (error) {next(error);}
}

async function repostPost(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });
    const existing = await repostModel.findRepost(req.user.sub, req.params.id);
    if (existing) return res.status(409).json({ message: "Você já recompartilhou este post" });
    return res.status(201).json(await repostModel.createRepost({ user_id: req.user.sub, post_id: req.params.id }));
  } catch (error) {next(error);}
}

async function undoRepost(req, res, next) {
  try {
    const repost = await repostModel.findRepost(req.user.sub, req.params.id);
    if (!repost) return res.status(404).json({ message: "Recompartilhamento não encontrado" });
    await repostModel.deleteRepost(repost.id);
    return res.status(204).send();
  } catch (error) {next(error);}
}

async function reportPost(req, res, next) {
  try {
    if (!req.body.reason) return res.status(400).json({ message: "Motivo da denúncia é obrigatório" });
    const post = await postModel.getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });
    const report = await reportModel.createReport({ reason: req.body.reason, post_id: req.params.id, reporter_id: req.user.sub });
    return res.status(201).json(report);
  } catch (error) {next(error);}
}

async function savePost(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id, req.user.sub);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });
    await postModel.savePost(req.user.sub, req.params.id);
    return res.status(201).json({ message: "Post salvo com sucesso" });
  } catch (error) {next(error);}
}

async function unsavePost(req, res, next) {
  try {
    await postModel.unsavePost(req.user.sub, req.params.id);
    return res.status(204).send();
  } catch (error) {next(error);}
}

async function listSavedPosts(req, res, next) {
  try {
    const saved = await postModel.getSavedPosts(req.user.sub);
    return res.status(200).json(saved);
  } catch (error) {next(error);}
}

async function downloadPostMedia(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id, req.user.sub);
    if (!post) return res.status(404).json({ message: "Post não encontrado" });

    const mediaUrl = post.image_url || post.video_url || post.media_url;
    if (!mediaUrl) return res.status(404).json({ message: "Este post não possui mídia para download" });

    await postModel.incrementDownloadCount(req.params.id);

    return res.status(200).json({ downloadUrl: mediaUrl, message: "Use esta URL para baixar a mídia." });
  } catch (error) {next(error);}
}

async function getArchivedPosts(req, res, next) {
  try {
    const userId = req.user?.id || req.userId;
    const posts = await postModel.getArchivedPosts(userId);
    res.json(posts);
  } catch (error) {
    next(error);
  }
}

async function restorePost(req, res, next) {
  try {
    const post = await postModel.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post não encontrado" });

    const userId = req.user?.id || req.userId;
    if (post.user_id !== userId && post.user?.id !== userId && post.author?.id !== userId) {
      return res.status(403).json({ error: "Apenas o autor pode restaurar" });
    }

    await postModel.restorePost(req.params.id);
    res.json({ message: "Post restaurado com sucesso" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPosts, getPostById, createPost, updatePost, deletePost,
  listReposts, repostPost, undoRepost, reportPost,
  savePost, unsavePost, listSavedPosts, downloadPostMedia,
  getArchivedPosts, restorePost
};