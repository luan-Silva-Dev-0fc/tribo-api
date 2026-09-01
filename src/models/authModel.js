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
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .ilike("email", cleanEmail)
      .select()
      .maybeSingle();
    if (!error && data) return data;
  } catch (err) {}

  try {
    const [user] = await sql`
      UPDATE users
      SET ${sql(payload)}, updated_at = NOW()
      WHERE LOWER(email) = ${cleanEmail}
      RETURNING *
    `;
    if (user) return user;
  } catch (err) {}

  return null;
}

async function updateUserById(id, payload) {
  if (!id) return null;

  try {
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (!error && data) return data;
  } catch (err) {}

  try {
    const [user] = await sql`
      UPDATE users
      SET ${sql(payload)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (user) return user;
  } catch (err) {}

  return null;
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