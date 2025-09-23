import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const sslEnabled = (process.env.DATABASE_SSL || 'false').toLowerCase() === 'true';

// Pool tuning via env
const poolMax = parseInt(process.env.PGPOOL_MAX || '10', 10);
const poolMin = parseInt(process.env.PGPOOL_MIN || '0', 10);
const poolIdleMs = parseInt(process.env.PG_IDLE_TIMEOUT_MS || '10000', 10);
const poolConnTimeoutMs = parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '5000', 10);
const statementTimeoutMs = parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '0', 10); // 0 = disabled

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: poolMax,
  min: poolMin,
  idleTimeoutMillis: poolIdleMs,
  connectionTimeoutMillis: poolConnTimeoutMs,
});

// Optional per-connection statement timeout
if (statementTimeoutMs > 0) {
  pool.on('connect', (client) => {
    client.query(`SET statement_timeout TO ${statementTimeoutMs}`)
      .catch(() => { /* ignore */ });
  });
}

export const db = drizzle(pool);


