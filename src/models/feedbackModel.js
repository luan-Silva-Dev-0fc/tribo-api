const { supabase } = require("../config/database");

async function createFeedback({ userId, subject, message }) {
  const { data, error } = await supabase.
  from("feedbacks").
  insert({
    user_id: userId,
    subject,
    message,
    status: "pending"
  }).
  select().
  single();

  if (error) throw error;
  return data;
}

async function getAllFeedbacks() {
  const { data, error } = await supabase.
  from("feedbacks").
  select("*, user:users!feedbacks_user_id_fkey(id, name, username, email, avatar_url, badge_type, email_verified)").
  order("created_at", { ascending: false });

  if (error) {

    const { data: raw, error: rawError } = await supabase.
    from("feedbacks").
    select("*").
    order("created_at", { ascending: false });
    if (rawError) throw rawError;
    return raw || [];
  }

  return (data || []).map((item) => {
    if (item.user) {
      item.user.email_verified = Boolean(item.user.email_verified || item.user.verified);
      item.user.badge_type = item.user.badge_type || (item.user.email_verified ? 'BLUE' : 'NONE');
    }
    return item;
  });
}

async function getFeedbackById(id) {
  const { data, error } = await supabase.
  from("feedbacks").
  select("*, user:users!feedbacks_user_id_fkey(id, name, username, email, avatar_url, badge_type, email_verified)").
  eq("id", id).
  maybeSingle();

  if (error) {
    const { data: raw, error: rawError } = await supabase.
    from("feedbacks").
    select("*").
    eq("id", id).
    maybeSingle();
    if (rawError) throw rawError;
    return raw;
  }

  if (data && data.user) {
    data.user.email_verified = Boolean(data.user.email_verified || data.user.verified);
    data.user.badge_type = data.user.badge_type || (data.user.email_verified ? 'BLUE' : 'NONE');
  }
  return data;
}

async function updateFeedbackStatus(id, status) {
  const { data, error } = await supabase.
  from("feedbacks").
  update({ status }).
  eq("id", id).
  select().
  maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  createFeedback,
  getAllFeedbacks,
  getFeedbackById,
  updateFeedbackStatus
};