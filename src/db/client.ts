import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const sslEnabled = (process.env.DATABASE_SSL || 'false').toLowerCase() === 'true';

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool);


