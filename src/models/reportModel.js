const { supabase } = require("../config/database");

async function createReport(payload) {
  const { data, error } = await supabase.
  from("reports").
  insert(payload).
  select().
  single();
  if (error) throw error;
  return data;
}

async function getAllDetailedReports() {
  const { data: reports, error } = await supabase.
  from("reports").
  select("*, reporter:users!reports_reporter_id_fkey(id, name, username, email, avatar_url), reported_user:users!reports_reported_user_idTousers(id, name, username, email, avatar_url, status), post:posts(id, content, image_url, video_url, author_id, created_at, author:users!posts_author_id_fkey(id, name, username, avatar_url, status))").
  order("created_at", { ascending: false });

  if (error) {
    const { data: rawReports, error: rawError } = await supabase.
    from("reports").
    select("*").
    order("created_at", { ascending: false });
    if (rawError) throw rawError;
    return rawReports || [];
  }
  return reports || [];
}

async function getAllReports(reporterId) {
  let query = supabase.
  from("reports").
  select("*").
  order("created_at", { ascending: false });
  if (reporterId) query = query.eq("reporter_id", reporterId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getReportById(id) {
  const { data: report, error } = await supabase.
  from("reports").
  select("*, reporter:users!reports_reporter_id_fkey(id, name, username, email, avatar_url), reported_user:users!reports_reported_user_idTousers(id, name, username, email, avatar_url, status), post:posts(id, content, image_url, video_url, author_id, created_at, author:users!posts_author_id_fkey(id, name, username, avatar_url, status))").
  eq("id", id).
  maybeSingle();

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase.
    from("reports").
    select("*").
    eq("id", id).
    maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallback;
  }
  return report;
}

async function updateReport(id, payload) {
  const { data, error } = await supabase.
  from("reports").
  update(payload).
  eq("id", id).
  select().
  maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteReport(id) {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw error;
}

module.exports = {
  createReport,
  getAllReports,
  getAllDetailedReports,
  getReportById,
  updateReport,
  deleteReport
};