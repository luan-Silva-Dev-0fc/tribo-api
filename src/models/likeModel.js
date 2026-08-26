const { supabase, sql } = require("../config/database");

async function findLike(userId, postId, commentId) {
  let query = supabase.from("likes").select("*").eq("user_id", userId);
  if (postId) query = query.eq("post_id", postId);
  if (commentId) query = query.eq("comment_id", commentId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function toggleLike({ userId, postId, commentId }) {
  let targetPostId = postId;
  let targetCommentId = commentId;

  if (targetPostId) {
    const { data: post, error: postErr } = await supabase.
    from("posts").
    select("id, author_id").
    eq("id", targetPostId).
    maybeSingle();

    if (!post) {

      const { data: fallbackComment } = await supabase.
      from("comments").
      select("id, author_id, post_id").
      eq("id", targetPostId).
      maybeSingle();

      if (fallbackComment) {
        targetCommentId = targetPostId;
        targetPostId = null;
      } else {
        const err = new Error("Publicação ou comentário não encontrado");
        err.status = 404;
        throw err;
      }
    } else {
      const existingLike = await findLike(userId, targetPostId, null);
      if (existingLike) {
        await supabase.from("likes").delete().eq("id", existingLike.id);
        const [{ count }] = await sql`SELECT count(*)::int as count FROM likes WHERE post_id = ${targetPostId};`;
        return {
          isLiked: false,
          liked: false,
          likesCount: Number(count || 0),
          postOwnerId: post.author_id,
          postId: targetPostId
        };
      } else {
        const { data: newLike, error: insertErr } = await supabase.
        from("likes").
        insert({ user_id: userId, post_id: targetPostId }).
        select().
        single();
        if (insertErr) throw insertErr;
        const [{ count }] = await sql`SELECT count(*)::int as count FROM likes WHERE post_id = ${targetPostId};`;
        return {
          isLiked: true,
          liked: true,
          like: newLike,
          likesCount: Number(count || 0),
          postOwnerId: post.author_id,
          postId: targetPostId
        };
      }
    }
  }

  if (targetCommentId) {
    const { data: comment, error: commentErr } = await supabase.
    from("comments").
    select("id, author_id, post_id").
    eq("id", targetCommentId).
    maybeSingle();

    if (!comment) {
      const err = new Error("Comentário não encontrado");
      err.status = 404;
      throw err;
    }

    const existingLike = await findLike(userId, null, targetCommentId);
    if (existingLike) {
      await supabase.from("likes").delete().eq("id", existingLike.id);
      const [{ count }] = await sql`SELECT count(*)::int as count FROM likes WHERE comment_id = ${targetCommentId};`;
      return {
        isLiked: false,
        liked: false,
        likesCount: Number(count || 0),
        commentOwnerId: comment.author_id,
        commentId: targetCommentId,
        postId: comment.post_id
      };
    } else {
      const { data: newLike, error: insertErr } = await supabase.
      from("likes").
      insert({ user_id: userId, comment_id: targetCommentId }).
      select().
      single();
      if (insertErr) throw insertErr;
      const [{ count }] = await sql`SELECT count(*)::int as count FROM likes WHERE comment_id = ${targetCommentId};`;
      return {
        isLiked: true,
        liked: true,
        like: newLike,
        likesCount: Number(count || 0),
        commentOwnerId: comment.author_id,
        commentId: targetCommentId,
        postId: comment.post_id
      };
    }
  }

  const err = new Error("Informe postId ou commentId");
  err.status = 400;
  throw err;
}

async function createLike(payload) {
  const { data, error } = await supabase.
  from("likes").
  insert(payload).
  select().
  single();
  if (error) throw error;
  return data;
}

async function getAllLikes({ postId, commentId, userId } = {}) {
  let query = supabase.
  from("likes").
  select("*").
  order("created_at", { ascending: false });
  if (postId) query = query.eq("post_id", postId);
  if (commentId) query = query.eq("comment_id", commentId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getLikeById(id) {
  const { data, error } = await supabase.
  from("likes").
  select("*").
  eq("id", id).
  maybeSingle();
  if (error) throw error;
  return data;
}

async function updateLike(id, payload) {
  const { data, error } = await supabase.
  from("likes").
  update(payload).
  eq("id", id).
  select().
  maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteLike(id) {
  const { error } = await supabase.from("likes").delete().eq("id", id);
  if (error) throw error;
}

module.exports = {
  findLike,
  toggleLike,
  createLike,
  getAllLikes,
  getLikeById,
  updateLike,
  deleteLike
};