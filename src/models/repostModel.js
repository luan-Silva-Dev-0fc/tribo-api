const { supabase } = require('../config/database');

async function createRepost(payload) {
  const { data, error } = await supabase.from('reposts').insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function findRepost(userId, postId) {
  const { data, error } = await supabase.from('reposts').select('*').eq('user_id', userId).eq('post_id', postId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getRepostsByPost(postId) {
  const { data, error } = await supabase.from('reposts').select('*').eq('post_id', postId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function deleteRepost(id) {
  const { error } = await supabase.from('reposts').delete().eq('id', id);
  if (error) throw error;
}

module.exports = { createRepost, findRepost, getRepostsByPost, deleteRepost };