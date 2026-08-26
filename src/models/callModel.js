const { supabase } = require("../config/database");

async function startCall(payload) {
  const { data, error } = await supabase.
  from("calls").
  insert(payload).
  select().
  single();
  if (error) throw error;
  return data;
}

async function getAllCalls(startedBy) {
  let query = supabase.
  from("calls").
  select("*").
  order("created_at", { ascending: false });
  if (startedBy) query = query.eq("started_by", startedBy);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getCallById(id) {
  const { data, error } = await supabase.
  from("calls").
  select("*").
  eq("id", id).
  maybeSingle();
  if (error) throw error;
  return data;
}

async function updateCall(id, payload) {
  const { data, error } = await supabase.
  from("calls").
  update(payload).
  eq("id", id).
  select().
  maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteCall(id) {
  const { error } = await supabase.from("calls").delete().eq("id", id);
  if (error) throw error;
}

async function endCall(id) {
  const { data, error } = await supabase.
  from("calls").
  update({ ended_at: new Date().toISOString() }).
  eq("id", id).
  select().
  single();
  if (error) throw error;
  return data;
}

module.exports = {
  startCall,
  endCall,
  getAllCalls,
  getCallById,
  updateCall,
  deleteCall
};