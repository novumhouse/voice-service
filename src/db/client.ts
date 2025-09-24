import { config } from 'dotenv';
config();

import fs from 'node:fs';
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

// Build SSL config with optional CA certificate support (e.g., DigitalOcean, RDS)
let sslOption: false | { rejectUnauthorized?: boolean; ca?: string } = false;
if (sslEnabled) {
  const caPath = process.env.DATABASE_CA_CERT_PATH || process.env.DO_CA_CERT_PATH;
  // Support inline CA content or base64 (and a common env typo DO_CA_CART)
  const caInline = process.env.DATABASE_CA_CERT || process.env.DO_CA_CERT || process.env.DO_CA_CART;
  let caContent: string | undefined;
  if (caPath) {
    try {
      caContent = fs.readFileSync(caPath, 'utf8');
    } catch {
      // ignore read errors, will fall back below
    }
  }
  if (!caContent && caInline) {
    caContent = caInline.includes('BEGIN CERTIFICATE')
      ? caInline
      : (() => {
          try {
            return Buffer.from(caInline, 'base64').toString('utf8');
          } catch {
            return undefined;
          }
        })();
  }
  sslOption = caContent
    ? { ca: caContent, rejectUnauthorized: true }
    : { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString,
  ssl: sslOption,
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


