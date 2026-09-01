const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');
const env = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

const sql = postgres(env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  connect_timeout: 30,
  idle_timeout: 60,
  max_lifetime: 60 * 30,
  max: 15,
  prepare: false,
  onnotice: () => {}
});

module.exports = { supabase, sql };