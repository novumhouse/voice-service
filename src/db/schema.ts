import { pgTable, text, timestamp, integer, boolean, jsonb, varchar, date as pgDate } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Note: Users table exists in the main DB already; we will reference by uuid/text IDs.

export const voiceSessions = pgTable('voice_sessions', {
  id: text('id').primaryKey().notNull(),
  userUuid: text('user_uuid').notNull(),
  userName: text('user_name').notNull(),
  conversationId: text('conversation_id').notNull(),
  agentId: text('agent_id').notNull(),
  elevenLabsConversationId: text('elevenlabs_conversation_id'),
  status: varchar('status', { length: 16 }).notNull(), // starting|active|ending|ended|error
  clientType: varchar('client_type', { length: 16 }).notNull(), // web|flutter|mobile
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Minimal mapping of existing users table for FK ops and inserts
export const users = pgTable('users', {
  uuid: text('uuid').notNull(),
  firstName: varchar('first_name', { length: 50 }),
  lastName: varchar('last_name', { length: 50 }),
});

export const userVoiceUsageDaily = pgTable('user_voice_usage_daily', {
  userUuid: text('user_uuid').notNull(),
  usageDate: pgDate('usage_date', { mode: 'string' }).notNull(),
  totalDuration: integer('total_duration').notNull().default(0),
  sessionCount: integer('session_count').notNull().default(0),
  limitSeconds: integer('limit_seconds').notNull(),
  isLimitReached: boolean('is_limit_reached').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    sql`PRIMARY KEY (${table.userUuid}, ${table.usageDate})`,
  ];
});


