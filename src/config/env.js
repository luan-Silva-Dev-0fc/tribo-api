const dotenv = require('dotenv');

dotenv.config();

const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || '';
const port = Number(process.env.PORT) || 3000;
const databaseUrl = process.env.DATABASE_URL || '';
const jwtSecret = process.env.JWT_SECRET || 'tribo_jwt_secret_production_key_2026';

if (!databaseUrl) {
  console.warn('⚠️ [Config] DATABASE_URL não definida nas variáveis de ambiente.');
}

module.exports = {
  PORT: port,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: supabaseKey,
  JWT_SECRET: jwtSecret,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY: process.env.R2_ACCESS_KEY || '',
  R2_SECRET_KEY: process.env.R2_SECRET_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || 'https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev',
  DATABASE_URL: databaseUrl,
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Tribo <onboarding@resend.dev>',
  APP_LATEST_VERSION: process.env.APP_LATEST_VERSION || '1.2.0',
  APP_DOWNLOAD_URL: process.env.APP_DOWNLOAD_URL || 'https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || ''
};