const { supabase, sql } = require("../config/database");

async function createUser(userData) {
  const { data, error } = await supabase.
  from("users").
  insert(userData).
  select().
  single();
  if (error) throw error;
  return data;
}

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  const cleanLower = clean.toLowerCase().replace(/^@/, '');

  try {
    const [user] = await sql`
      SELECT * FROM users
      WHERE LOWER(email) = ${cleanLower}
         OR LOWER(username) = ${cleanLower}
      LIMIT 1
    `;
    if (user) return user;
  } catch (err) {}

  try {
    const { data } = await supabase.
    from("users").
    select("*").
    or(`email.ilike.${cleanLower},username.ilike.${cleanLower}`).
    maybeSingle();
    return data || null;
  } catch (err) {
    return null;
  }
}

async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const [user] = await sql`
      SELECT * FROM users
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1
    `;
    if (user) return user;
  } catch (err) {}

  try {
    const { data } = await supabase.
    from("users").
    select("*").
    ilike("email", cleanEmail).
    maybeSingle();
    return data || null;
  } catch (err) {
    return null;
  }
}

async function findUserById(id) {
  const { data, error } = await supabase.
  from("users").
  select("*").
  eq("id", id).
  maybeSingle();
  if (error) throw error;
  return data;
}

async function findUserByUsername(username) {
  if (!username) return null;
  const clean = String(username).trim().toLowerCase().replace(/^@/, '');

  try {
    const [user] = await sql`
      SELECT id, username FROM users
      WHERE LOWER(username) = ${clean}
      LIMIT 1
    `;
    if (user) return user;
  } catch (err) {}

  const { data, error } = await supabase.
  from("users").
  select("id, username").
  ilike("username", clean).
  maybeSingle();
  if (error) throw error;
  return data;
}

async function updateUserByEmail(email, payload) {
  const { data, error } = await supabase.
  from("users").
  update(payload).
  eq("email", email).
  select().
  single();
  if (error) throw error;
  return data;
}

async function updateUserById(id, payload) {
  const { data, error } = await supabase.
  from("users").
  update(payload).
  eq("id", id).
  select().
  single();
  if (error) throw error;
  return data;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUserByIdentifier,
  updateUserByEmail,
  updateUserById
};