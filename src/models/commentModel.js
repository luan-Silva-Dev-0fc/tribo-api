const { supabase } = require("../config/database");

const commentSelect = "*, author:users!comments_author_id_fkey(id, username, name, avatar_url, badge_type, email_verified), likes(id, user_id)";

function formatComment(comment) {
  if (!comment) return comment;
  const { likes, ...rest } = comment;
  const likesArray = Array.isArray(likes) ? likes : [];

  if (rest.author) {
    rest.author.email_verified = Boolean(rest.author.email_verified || rest.author.verified);
    rest.author.badge_type = rest.author.badge_type || (rest.author.email_verified ? 'BLUE' : 'NONE');
  }

  return {
    ...rest,
    likes: likesArray,
    likesCount: likesArray.length
  };
}

async function createComment(payload) {
  const { data, error } = await supabase.
  from("comments").
  insert(payload).
  select(commentSelect).
  single();
  if (error) throw error;
  return formatComment(data);
}

async function getAllComments(postId) {
  let query = supabase.
  from("comments").
  select(commentSelect).
  order("created_at", { ascending: true });
  if (postId) query = query.eq("post_id", postId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(formatComment);
}

async function getCommentById(id) {
  const { data, error } = await supabase.
  from("comments").
  select(commentSelect).
  eq("id", id).
  maybeSingle();
  if (error) throw error;
  return formatComment(data);
}

async function updateComment(id, payload) {
  const { data, error } = await supabase.
  from("comments").
  update(payload).
  eq("id", id).
  select(commentSelect).
  maybeSingle();
  if (error) throw error;
  return formatComment(data);
}

async function deleteComment(id) {
  try {
    await supabase.from("notifications").delete().eq("comment_id", id);
  } catch (e) {}
  try {
    await supabase.from("likes").delete().eq("comment_id", id);
  } catch (e) {}
  try {
    await supabase.from("comments").delete().eq("parent_id", id);
  } catch (e) {}
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

module.exports = {
  createComment,
  getAllComments,
  getCommentById,
  updateComment,
  deleteComment
};