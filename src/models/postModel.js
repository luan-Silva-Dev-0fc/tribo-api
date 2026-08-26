const { supabase, sql } = require("../config/database");
const { getBlockedUserIds } = require("./blockModel");
const { getAcceptedFollowingIds, isFollowingAccepted } = require("./followModel");

const postSelect = "*, author:users!posts_author_id_fkey(id, username, name, bio, avatar_url, badge_type, email_verified, is_private, status), likes(id, user_id), reposted_post:repost_post_id(*, author:users!posts_author_id_fkey(id, username, name, avatar_url, badge_type, email_verified))";

function withPostMetadata(post) {
  if (!post) return post;

  const { author, likes, reposted_post, ...postData } = post;

  const formattedAuthor = author ?
  {
    ...author,
    bio: author.bio && String(author.bio).trim() !== "" ? String(author.bio).trim() : null,
    is_private: Boolean(author.is_private),
    email_verified: Boolean(author.email_verified || author.verified),
    badge_type: author.badge_type || (author.verified || author.email_verified ? 'BLUE' : 'NONE')
  } :
  null;

  let formattedReposted = null;
  if (reposted_post) {
    formattedReposted = {
      ...reposted_post,
      author: reposted_post.author ? {
        ...reposted_post.author,
        email_verified: Boolean(reposted_post.author.email_verified || reposted_post.author.verified),
        badge_type: reposted_post.author.badge_type || (reposted_post.author.verified || reposted_post.author.email_verified ? 'BLUE' : 'NONE')
      } : null
    };
  }

  const likesArray = Array.isArray(likes) ? likes : [];

  return {
    ...postData,
    author: formattedAuthor,
    reposted_post: formattedReposted,
    likes: likesArray,
    likesCount: likesArray.length,
    isNSFW: Boolean(postData.is_nsfw),
    audioUrl: postData.audio_url || null,
    audio_url: postData.audio_url || null,
    youtubeUrl: postData.youtube_url || null,
    youtube_url: postData.youtube_url || null,
    youtubeVideoId: postData.youtube_video_id || null,
    youtube_video_id: postData.youtube_video_id || null,
    mediaType: postData.media_type || (postData.youtube_video_id ? 'youtube' : postData.video_url ? 'video' : postData.audio_url ? 'audio' : postData.image_url ? 'image' : null),
    media_type: postData.media_type || (postData.youtube_video_id ? 'youtube' : postData.video_url ? 'video' : postData.audio_url ? 'audio' : postData.image_url ? 'image' : null)
  };
}

async function getAllPosts(viewerId) {
  const [postsResult, blockedIds, followingIds, settingsResult, viewerRecord] = await Promise.all([
  supabase.
  from("posts").
  select(postSelect).
  is("deleted_at", null).
  order("created_at", { ascending: false }),
  viewerId ? getBlockedUserIds(viewerId) : Promise.resolve(new Set()),
  viewerId ? getAcceptedFollowingIds(viewerId) : Promise.resolve(new Set()),
  supabase.from('app_settings').select('global_feed_enabled').eq('id', 1).single(),
  viewerId ? sql`SELECT allow_nsfw_content FROM users WHERE id = ${viewerId} LIMIT 1` : Promise.resolve([])]
  );

  if (postsResult.error) throw postsResult.error;

  const isGlobalEnabled = settingsResult.data?.global_feed_enabled === true;
  const viewerAllowsNsfw = Boolean(viewerRecord?.[0]?.allow_nsfw_content);

  const filtered = (postsResult.data || []).filter((post) => {
    if (post.author?.status === "BANNED") return false;
    const authorId = post.author_id || post.user_id;
    if (viewerId && (blockedIds.has(post.author_id) || blockedIds.has(post.user_id))) {
      return false;
    }

    if (Boolean(post.is_nsfw) && !viewerAllowsNsfw) {
      return false;
    }

    if (!isGlobalEnabled) {
      if (!viewerId) return false;
      if (authorId !== viewerId && !followingIds.has(authorId)) {
        return false;
      }
    } else {

      if (post.author?.is_private) {
        if (!viewerId) return false;
        if (authorId !== viewerId && !followingIds.has(authorId)) {
          return false;
        }
      }
    }

    return true;
  });

  return filtered.map(withPostMetadata);
}

async function getAllPostsForAdmin() {
  const { data, error } = await supabase.
  from("posts").
  select(postSelect).
  is("deleted_at", null).
  order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(withPostMetadata);
}

async function getPostById(id, viewerId) {
  const [postResult, blockedIds] = await Promise.all([
  supabase.
  from("posts").
  select(postSelect).
  eq("id", id).
  maybeSingle(),
  viewerId ? getBlockedUserIds(viewerId) : Promise.resolve(new Set())]
  );

  if (postResult.error) throw postResult.error;
  const data = postResult.data;
  if (!data) return null;

  if (data.author?.status === "BANNED") return null;
  const authorId = data.author_id || data.user_id;
  if (viewerId && (blockedIds.has(data.author_id) || blockedIds.has(data.user_id))) {
    return null;
  }

  if (data.author?.is_private && viewerId !== authorId) {
    const isAllowed = viewerId ? await isFollowingAccepted(viewerId, authorId) : false;
    if (!isAllowed) {
      return {
        id: data.id,
        is_private: true,
        restricted: true,
        message: "Este post pertence a um perfil privado"
      };
    }
  }

  return withPostMetadata(data);
}

async function getPostsByUserId(userId, viewerId) {
  const [userResult, blockedIds, viewerRecord] = await Promise.all([
  supabase.from("users").select("id, is_private, status").eq("id", userId).maybeSingle(),
  viewerId ? getBlockedUserIds(viewerId) : Promise.resolve(new Set()),
  viewerId ? sql`SELECT allow_nsfw_content FROM users WHERE id = ${viewerId} LIMIT 1` : Promise.resolve([])]
  );

  if (userResult.error) throw userResult.error;
  const targetUser = userResult.data;
  if (!targetUser || targetUser.status === "BANNED") return null;
  if (viewerId && blockedIds.has(userId)) return null;

  const isSelf = String(viewerId) === String(userId);
  const viewerAllowsNsfw = Boolean(viewerRecord?.[0]?.allow_nsfw_content);

  if (targetUser.is_private && !isSelf) {
    const isAllowed = viewerId ? await isFollowingAccepted(viewerId, userId) : false;
    if (!isAllowed) {
      return {
        is_private: true,
        can_view_content: false,
        message: "Este perfil é privado. Siga para ver as publicações.",
        posts: []
      };
    }
  }

  const { data, error } = await supabase.
  from("posts").
  select(postSelect).
  is("deleted_at", null).
  or(`author_id.eq.${userId},user_id.eq.${userId}`).
  order("created_at", { ascending: false });

  if (error) throw error;

  const visiblePosts = (data || []).filter((p) => {
    if (Boolean(p.is_nsfw) && !viewerAllowsNsfw && !isSelf) {
      return false;
    }
    return true;
  });

  return {
    is_private: Boolean(targetUser.is_private),
    can_view_content: true,
    posts: visiblePosts.map(withPostMetadata)
  };
}

async function createPost(payload) {
  const { data, error } = await supabase.
  from("posts").
  insert(payload).
  select(postSelect).
  single();
  if (error) throw error;
  return withPostMetadata(data);
}

async function updatePost(id, payload) {
  const { data, error } = await supabase.
  from("posts").
  update(payload).
  eq("id", id).
  select(postSelect).
  single();
  if (error) throw error;
  return withPostMetadata(data);
}

async function deletePost(id) {
  const { error } = await supabase.
  from("posts").
  update({ deleted_at: new Date().toISOString() }).
  eq("id", id);
  if (error) throw error;
}

async function savePost(userId, postId) {
  const { data, error } = await supabase.
  from("saved_posts").
  insert({ user_id: userId, post_id: postId }).
  select().
  single();
  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

async function unsavePost(userId, postId) {
  const { error } = await supabase.
  from("saved_posts").
  delete().
  match({ user_id: userId, post_id: postId });
  if (error) throw error;
}

async function getSavedPosts(userId) {
  const { data, error } = await supabase.
  from("saved_posts").
  select(`created_at, posts(${postSelect})`).
  eq("user_id", userId).
  order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((item) => ({
    saved_at: item.created_at,
    post: withPostMetadata(item.posts)
  }));
}

async function getArchivedPosts(userId) {
  const { data, error } = await supabase.
  from("posts").
  select(postSelect).
  eq("user_id", userId).
  not("deleted_at", "is", null).
  order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(withPostMetadata);
}

async function restorePost(id) {
  const { error } = await supabase.
  from("posts").
  update({ deleted_at: null }).
  eq("id", id);
  if (error) throw error;
}

async function incrementDownloadCount(id) {

  const { data: post } = await supabase.from("posts").select("downloads_count").eq("id", id).single();
  if (post) {
    const { error } = await supabase.
    from("posts").
    update({ downloads_count: (post.downloads_count || 0) + 1 }).
    eq("id", id);
    if (error) throw error;
  }
}

module.exports = {
  getAllPosts,
  getAllPostsForAdmin,
  getPostById,
  getPostsByUserId,
  createPost,
  updatePost,
  deletePost,
  savePost,
  unsavePost,
  getSavedPosts,
  getArchivedPosts,
  restorePost,
  incrementDownloadCount
};