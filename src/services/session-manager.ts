/**
 * Voice Session Manager
 * Manages conversation sessions, state, and usage tracking
 */

interface VoiceSession {
  id: string;
  userUuid: string;
  userName: string;
  userToken: string;
  conversationId: string;
  agentId: string;
  elevenLabsConversationId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  status: 'starting' | 'active' | 'ending' | 'ended' | 'error';
  clientType: 'web' | 'flutter' | 'mobile';
  metadata?: Record<string, any>;
}

interface UserVoiceUsage {
  userUuid: string; // uuid key for usage aggregation
  date: string;
  totalDuration: number;
  sessionCount: number;
  limit: number;
  isLimitReached: boolean;
}

import { db } from '../db/client.js';
import { voiceSessions, userVoiceUsageDaily } from '../db/schema.js';
import { 
  cacheSet,
  cacheGet,
  cacheDel,
  cacheSAdd,
  cacheSMembers,
  cacheSRem,
  cacheExpire
} from '../utils/redis.js';
import { eq, and, isNull } from 'drizzle-orm';

class VoiceSessionManager {
  // Legacy in-memory stores replaced by Redis
  private userUsage: Map<string, UserVoiceUsage> = new Map();
  private readonly DAILY_LIMIT_SECONDS = parseInt(process.env.VOICE_TIME_LIMIT || '600', 10);
  private readonly SESSION_TTL_SECONDS = (parseInt(process.env.VOICE_SESSION_TTL_MINUTES || '60', 10)) * 60; // default 60m

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userUuid: string): string {
    return `user_sessions:${userUuid}`;
  }

  private getActiveSessionsSetKey(): string {
    return 'sessions:active';
  }

  private async dbLoadSession(sessionId: string): Promise<VoiceSession | null> {
    try {
      const rows = await db
        .select()
        .from(voiceSessions)
        .where(eq(voiceSessions.id, sessionId))
        .limit(1);
      if (rows.length === 0) return null;
      const r = rows[0] as any;
      return {
        id: r.id,
        userUuid: r.userUuid,
        userName: r.userName,
        userToken: '',
        conversationId: r.conversationId,
        agentId: r.agentId,
        elevenLabsConversationId: r.elevenLabsConversationId ?? undefined,
        startTime: new Date(r.startTime),
        endTime: r.endTime ? new Date(r.endTime) : undefined,
        duration: r.durationSeconds ?? 0,
        status: r.status,
        clientType: r.clientType,
        metadata: r.metadata ?? undefined,
      };
    } catch (e) {
      console.warn('⚠️ Failed to load session from DB:', e);
      return null;
    }
  }

  /**
   * Create a new voice session
   */
  public async createSession(params: {
    userUuid: string;
    userName: string;
    userToken: string;
    conversationId: string;
    agentId: string;
    clientType: 'web' | 'flutter' | 'mobile';
    metadata?: Record<string, any>;
  }): Promise<VoiceSession> {
    
    // Check daily usage limit (uuid)
    const usageKey = params.userUuid;
    const usage = await this.getUserDailyUsage(usageKey);
    if (usage.isLimitReached) {
      throw new Error('Daily voice usage limit reached');
    }

    const session: VoiceSession = {
      id: this.generateSessionId(),
      userUuid: params.userUuid,
      userName: params.userName,
      userToken: params.userToken,
      conversationId: params.conversationId,
      agentId: params.agentId,
      startTime: new Date(),
      duration: 0,
      status: 'starting',
      clientType: params.clientType,
      metadata: params.metadata || {}
    };

    // Cache in Redis for cross-instance visibility
    await cacheSet(this.getSessionKey(session.id), this.serializeSession(session), { ttlSeconds: this.SESSION_TTL_SECONDS });
    await cacheSAdd(this.getActiveSessionsSetKey(), session.id, this.SESSION_TTL_SECONDS);
    await cacheSAdd(this.getUserSessionsKey(session.userUuid), session.id, this.SESSION_TTL_SECONDS);
    await cacheExpire(this.getUserSessionsKey(session.userUuid), this.SESSION_TTL_SECONDS);
    
    console.log(`📱 Created voice session ${session.id} for user ${usageKey} (${params.clientType})`);

    // Persist session start immediately
    try {
      await db.insert(voiceSessions).values({
        id: session.id,
        userUuid: session.userUuid,
        userName: session.userName,
        conversationId: session.conversationId,
        agentId: session.agentId,
        elevenLabsConversationId: null,
        status: 'starting',
        clientType: session.clientType,
        startTime: session.startTime as unknown as Date,
        endTime: null,
        durationSeconds: 0,
        metadata: session.metadata || null,
      });
    } catch (e) {
      console.warn('⚠️ Failed to persist session start, continuing:', e);
    }
    return session;
  }

  /**
   * Update session with ElevenLabs conversation ID
   */
  public async updateSessionWithElevenLabsId(sessionId: string, elevenLabsConversationId: string): Promise<void> {
    const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(sessionId));
    if (cached) {
      const session = this.deserializeSession(cached);
      session.elevenLabsConversationId = elevenLabsConversationId;
      session.status = 'active';
      await cacheSet(this.getSessionKey(sessionId), this.serializeSession(session), { ttlSeconds: this.SESSION_TTL_SECONDS });
      // Ensure set memberships and refresh TTLs
      await cacheSAdd(this.getActiveSessionsSetKey(), sessionId, this.SESSION_TTL_SECONDS);
      await cacheSAdd(this.getUserSessionsKey(session.userUuid), sessionId, this.SESSION_TTL_SECONDS);
      await cacheExpire(this.getUserSessionsKey(session.userUuid), this.SESSION_TTL_SECONDS);
    }
    // Always update DB, even if Redis miss
    await db.update(voiceSessions)
      .set({
        elevenLabsConversationId,
        status: 'active',
      })
      .where(eq(voiceSessions.id, sessionId));
  }

  /**
   * End a voice session and track usage
   */
  public async endSession(sessionId: string): Promise<VoiceSession | null> {
    const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(sessionId));
    let sessionObj = cached ? this.deserializeSession(cached) : await this.dbLoadSession(sessionId);
    if (!sessionObj) return null;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - sessionObj.startTime.getTime()) / 1000);

    sessionObj.endTime = endTime;
    sessionObj.duration = duration;
    sessionObj.status = 'ended';

    // Track usage (uuid)
    await this.trackVoiceUsage(sessionObj.userUuid, duration);

    // Update persisted session to ended
    try {
      await db.update(voiceSessions)
        .set({
          endTime: endTime as unknown as Date,
          durationSeconds: duration,
          status: 'ended',
        })
        .where(eq(voiceSessions.id, sessionObj.id));
    } catch (e) {
      console.warn('⚠️ Failed to update session end, continuing:', e);
    }

    // Remove from Redis caches
    await cacheDel(this.getSessionKey(sessionId)).catch(() => {});
    await cacheSRem(this.getActiveSessionsSetKey(), sessionId).catch(() => {});
    await cacheSRem(this.getUserSessionsKey(sessionObj.userUuid), sessionId).catch(() => {});

    console.log(`✅ Ended voice session ${sessionId} - Duration: ${duration}s`);
    return sessionObj;
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<VoiceSession | null> {
    const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(sessionId));
    if (cached) return this.deserializeSession(cached);
    return await this.dbLoadSession(sessionId);
  }

  /**
   * Get all active sessions for a user (by uuid)
   */
  public async getUserSessions(userUuid: string): Promise<VoiceSession[]> {
    const ids = await cacheSMembers(this.getUserSessionsKey(userUuid));
    const sessions: VoiceSession[] = [];
    for (const id of ids) {
      const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(id));
      if (cached) sessions.push(this.deserializeSession(cached));
    }
    if (sessions.length === 0) {
      try {
        const rows = await db
          .select()
          .from(voiceSessions)
          .where(and(eq(voiceSessions.userUuid, userUuid), isNull(voiceSessions.endTime)))
          .limit(50);
        return rows.map((r: any) => ({
          id: r.id,
          userUuid: r.userUuid,
          userName: r.userName,
          userToken: '',
          conversationId: r.conversationId,
          agentId: r.agentId,
          elevenLabsConversationId: r.elevenLabsConversationId ?? undefined,
          startTime: new Date(r.startTime),
          endTime: r.endTime ? new Date(r.endTime) : undefined,
          duration: r.durationSeconds ?? 0,
          status: r.status,
          clientType: r.clientType,
          metadata: r.metadata ?? undefined,
        }));
      } catch (e) {
        console.warn('⚠️ Failed to load user sessions from DB:', e);
      }
    }
    return sessions;
  }

  /**
   * Track voice usage for a user (keyed by uuid)
   */
  private async trackVoiceUsage(userKey: string, duration: number): Promise<void> {
    // Use Europe/Warsaw local date for daily aggregation
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date()); // YYYY-MM-DD (Warsaw local date)
    const key = `${userKey}_${today}`;
    
    let usage = this.userUsage.get(key);
    if (!usage) {
      usage = {
        userUuid: userKey,
        date: today,
        totalDuration: 0,
        sessionCount: 0,
        limit: this.DAILY_LIMIT_SECONDS,
        isLimitReached: false
      };
    }

    usage.totalDuration += duration;
    usage.sessionCount += 1;
    usage.isLimitReached = usage.totalDuration >= this.DAILY_LIMIT_SECONDS;

    this.userUsage.set(key, usage);

    await this.persistUsageToDatabase(usage);
  }

  /**
   * Get user's daily voice usage (keyed by uuid)
   */
  public async getUserDailyUsage(userKey: string): Promise<UserVoiceUsage> {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date());
    const key = `${userKey}_${today}`;
    
    let usage = this.userUsage.get(key);
    if (!usage) {
      // Load from database if not in memory
      usage = await this.loadUsageFromDatabase(userKey, today) ?? undefined;
      if (usage) {
        this.userUsage.set(key, usage);
      } else {
        usage = {
          userUuid: userKey,
          date: today,
          totalDuration: 0,
          sessionCount: 0,
          limit: this.DAILY_LIMIT_SECONDS,
          isLimitReached: false
        };
        this.userUsage.set(key, usage);
      }
    }

    return usage;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Persist usage to database (keyed by user_uuid)
   */
  private async persistUsageToDatabase(usage: UserVoiceUsage): Promise<void> {
    try {
      const usageDate = usage.date; // already formatted YYYY-MM-DD in Europe/Warsaw
      await db
        .insert(userVoiceUsageDaily)
        .values({
          userUuid: usage.userUuid,
          usageDate: usageDate as unknown as any,
          totalDuration: usage.totalDuration,
          sessionCount: usage.sessionCount,
          limitSeconds: usage.limit,
          isLimitReached: usage.isLimitReached,
        })
        .onConflictDoUpdate({
          target: [userVoiceUsageDaily.userUuid, userVoiceUsageDaily.usageDate],
          set: {
            totalDuration: usage.totalDuration,
            sessionCount: usage.sessionCount,
            limitSeconds: usage.limit,
            isLimitReached: usage.isLimitReached,
            updatedAt: new Date(),
          },
        });
    } catch (e) {
      console.warn('⚠️ Failed to persist usage, continuing:', e);
    }
  }

  /**
   * Load usage from database
   */
  private async loadUsageFromDatabase(userKey: string, date: string): Promise<UserVoiceUsage | null> {
    try {
      const usageDate = date as unknown as any;
      const rows = await db
        .select()
        .from(userVoiceUsageDaily)
        .where(and(eq(userVoiceUsageDaily.userUuid, userKey), eq(userVoiceUsageDaily.usageDate, usageDate)))
        .limit(1);

      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        userUuid: row.userUuid,
        date: date,
        totalDuration: row.totalDuration,
        sessionCount: row.sessionCount,
        limit: row.limitSeconds,
        isLimitReached: row.isLimitReached,
      };
    } catch (e) {
      console.warn('⚠️ Failed to load usage, defaulting to zero:', e);
      return null;
    }
  }

  /**
   * Cleanup expired sessions (run periodically)
   */
  public cleanupExpiredSessions(): void {
    // No-op; Redis TTL handles expiration. DB is updated on explicit end.
  }

  /**
   * Get service statistics
   */
  public async getServiceStats(): Promise<{
    activeSessions: number;
    totalUsers: number;
    avgSessionDuration: number;
  }> {
    const ids = await cacheSMembers(this.getActiveSessionsSetKey());
    let totalDuration = 0;
    const userSet = new Set<string>();
    let counted = 0;
    for (const id of ids) {
      const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(id));
      if (!cached) continue;
      const s = this.deserializeSession(cached);
      totalDuration += s.duration;
      userSet.add(s.userUuid);
      counted++;
    }
    if (ids.length > 0 && counted > 0) {
      return {
        activeSessions: ids.length,
        totalUsers: userSet.size,
        avgSessionDuration: counted > 0 ? Math.round(totalDuration / counted) : 0
      };
    }
    // Fallback to DB
    try {
      const rows = await db
        .select()
        .from(voiceSessions)
        .where(isNull(voiceSessions.endTime));
      const users = new Set<string>();
      let dur = 0;
      for (const r of rows as any[]) {
        users.add(r.userUuid);
        dur += r.durationSeconds ?? 0;
      }
      return {
        activeSessions: rows.length,
        totalUsers: users.size,
        avgSessionDuration: rows.length > 0 ? Math.round(dur / rows.length) : 0,
      };
    } catch {
      return { activeSessions: 0, totalUsers: 0, avgSessionDuration: 0 };
    }
  }

  /**
   * Get all active sessions (admin use)
   */
  public async getAllActiveSessions(): Promise<Array<Pick<VoiceSession, 'id' | 'userUuid' | 'userName' | 'conversationId' | 'agentId' | 'elevenLabsConversationId' | 'startTime' | 'status' | 'clientType' | 'duration'>>> {
    const ids = await cacheSMembers(this.getActiveSessionsSetKey());
    const result: Array<Pick<VoiceSession, 'id' | 'userUuid' | 'userName' | 'conversationId' | 'agentId' | 'elevenLabsConversationId' | 'startTime' | 'status' | 'clientType' | 'duration'>> = [];
    for (const id of ids) {
      const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(id));
      if (!cached) continue;
      const s = this.deserializeSession(cached);
      result.push({
        id: s.id,
        userUuid: s.userUuid,
        userName: s.userName,
        conversationId: s.conversationId,
        agentId: s.agentId,
        elevenLabsConversationId: s.elevenLabsConversationId,
        startTime: s.startTime,
        status: s.status,
        clientType: s.clientType,
        duration: s.duration,
      });
    }
    if (result.length > 0) return result;
    // Fallback to DB when Redis is empty
    try {
      const rows = await db
        .select()
        .from(voiceSessions)
        .where(isNull(voiceSessions.endTime))
        .limit(200);
      return (rows as any[]).map((r) => ({
        id: r.id,
        userUuid: r.userUuid,
        userName: r.userName,
        conversationId: r.conversationId,
        agentId: r.agentId,
        elevenLabsConversationId: r.elevenLabsConversationId ?? undefined,
        startTime: new Date(r.startTime),
        status: r.status,
        clientType: r.clientType,
        duration: r.durationSeconds ?? 0,
      }));
    } catch (e) {
      console.warn('⚠️ Failed to load active sessions from DB:', e);
      return [];
    }
  }

  /**
   * End all active sessions (admin use)
   */
  public async endAllActiveSessions(): Promise<{ ended: number; sessionIds: string[] }> {
    let ids = await cacheSMembers(this.getActiveSessionsSetKey());
    if (ids.length === 0) {
      try {
        const rows = await db
          .select({ id: voiceSessions.id })
          .from(voiceSessions)
          .where(isNull(voiceSessions.endTime));
        ids = (rows as any[]).map((r) => r.id);
      } catch (e) {
        console.warn('⚠️ Failed to fetch active sessions from DB for ending:', e);
      }
    }
    const endedIds: string[] = [];
    for (const id of ids) {
      const ended = await this.endSession(id);
      if (ended) endedIds.push(id);
    }
    return { ended: endedIds.length, sessionIds: endedIds };
  }

  // Helpers to serialize/deserialize session to JSON-safe structure
  private serializeSession(session: VoiceSession): {
    id: string;
    userUuid: string;
    userName: string;
    userToken: string;
    conversationId: string;
    agentId: string;
    elevenLabsConversationId?: string;
    startTime: string;
    endTime?: string;
    duration: number;
    status: VoiceSession['status'];
    clientType: VoiceSession['clientType'];
    metadata?: Record<string, any>;
  } {
    return {
      id: session.id,
      userUuid: session.userUuid,
      userName: session.userName,
      userToken: session.userToken,
      conversationId: session.conversationId,
      agentId: session.agentId,
      elevenLabsConversationId: session.elevenLabsConversationId,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime ? session.endTime.toISOString() : undefined,
      duration: session.duration,
      status: session.status,
      clientType: session.clientType,
      metadata: session.metadata,
    };
  }

  private deserializeSession(data: ReturnType<VoiceSessionManager['serializeSession']>): VoiceSession {
    return {
      id: data.id,
      userUuid: data.userUuid,
      userName: data.userName,
      userToken: data.userToken,
      conversationId: data.conversationId,
      agentId: data.agentId,
      elevenLabsConversationId: data.elevenLabsConversationId,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      duration: data.duration,
      status: data.status,
      clientType: data.clientType,
      metadata: data.metadata,
    };
  }

  /**
   * Debug state for admin: list active session IDs and a sample session
   */
  public async getDebugState(): Promise<{
    activeIds: string[];
    activeCount: number;
    sample?: VoiceSession;
  }> {
    const ids = await cacheSMembers(this.getActiveSessionsSetKey());
    let sample: VoiceSession | undefined = undefined;
    for (const id of ids) {
      const cached = await cacheGet<ReturnType<VoiceSessionManager['serializeSession']>>(this.getSessionKey(id));
      if (cached) {
        sample = this.deserializeSession(cached);
        break;
      }
    }
    return { activeIds: ids, activeCount: ids.length, sample };
  }
}

export const sessionManager = new VoiceSessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000);
