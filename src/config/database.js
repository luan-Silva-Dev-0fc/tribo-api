const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');
const env = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

const sql = postgres(env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

module.exports = { supabase, sql };