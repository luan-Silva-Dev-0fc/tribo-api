const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { createClient } = require('@supabase/supabase-js');
const postgres = require('postgres');
const env = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
  auth: { persistSession: false }
});

const sql = postgres(env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  connect_timeout: 15,
  max: 20,
  idle_timeout: 30
});

module.exports = { supabase, sql };