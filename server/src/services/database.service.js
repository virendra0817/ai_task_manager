import { Pool } from 'pg';

let pool;
let usersTableReady;

function databasePool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Add the Supabase PostgreSQL connection string to server/.env.');
  }

  if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string, not the Supabase project URL. Copy it from Supabase Project Settings > Database > Connection string.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  return pool;
}

export async function getDatabase() {
  const client = databasePool();
  if (!usersTableReady) {
    usersTableReady = client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        email_verified_at TIMESTAMPTZ,
        verification_token_hash TEXT,
        verification_token_expires_at TIMESTAMPTZ
      )
    `).then(() => Promise.all([
      client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ'),
      client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash TEXT'),
      client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ'),
    ]));
  }
  await usersTableReady;
  return client;
}
