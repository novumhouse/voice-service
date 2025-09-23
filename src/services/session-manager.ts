/**
 * Voice Session Manager
 * Manages conversation sessions, state, and usage tracking
 */

interface VoiceSession {
  id: string;
  userId: string;
  userUuid?: string;
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
  userId: string; // stores userUuid when available, else userId
  date: string;
  totalDuration: number;
  sessionCount: number;
  limit: number;
  isLimitReached: boolean;
}

import { db } from '../db/client.js';
import { voiceSessions, userVoiceUsageDaily } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

class VoiceSessionManager {
  private activeSessions: Map<string, VoiceSession> = new Map();
  private userUsage: Map<string, UserVoiceUsage> = new Map();
  private readonly DAILY_LIMIT_SECONDS = parseInt(process.env.VOICE_TIME_LIMIT || '600', 10);

  /**
   * Create a new voice session
   */
  public async createSession(params: {
    userId: string;
    userUuid?: string;
    userName: string;
    userToken: string;
    conversationId: string;
    agentId: string;
    clientType: 'web' | 'flutter' | 'mobile';
    metadata?: Record<string, any>;
  }): Promise<VoiceSession> {
    
    // Check daily usage limit (prefer uuid if present)
    const usageKey = params.userUuid || params.userId;
    const usage = await this.getUserDailyUsage(usageKey);
    if (usage.isLimitReached) {
      throw new Error('Daily voice usage limit reached');
    }

    const session: VoiceSession = {
      id: this.generateSessionId(),
      userId: params.userId,
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

    this.activeSessions.set(session.id, session);
    
    console.log(`📱 Created voice session ${session.id} for user ${usageKey} (${params.clientType})`);

    // Persist session start immediately if userUuid is available
    try {
      if (session.userUuid) {
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
      } else {
        console.warn('⚠️ Skipping DB insert on start: missing userUuid');
      }
    } catch (e) {
      console.warn('⚠️ Failed to persist session start, continuing:', e);
    }
    return session;
  }

  /**
   * Update session with ElevenLabs conversation ID
   */
  public updateSessionWithElevenLabsId(sessionId: string, elevenLabsConversationId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.elevenLabsConversationId = elevenLabsConversationId;
      session.status = 'active';
      this.activeSessions.set(sessionId, session);
      // Update DB record if present
      if (session.userUuid) {
        db.update(voiceSessions)
          .set({
            elevenLabsConversationId,
            status: 'active',
          })
          .where(eq(voiceSessions.id, sessionId))
          .catch((e) => console.warn('⚠️ Failed to update session to active:', e));
      }
    }
  }

  /**
   * End a voice session and track usage
   */
  public async endSession(sessionId: string): Promise<VoiceSession | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    session.endTime = endTime;
    session.duration = duration;
    session.status = 'ended';

    // Track usage (prefer uuid if present)
    await this.trackVoiceUsage(session.userUuid || session.userId, duration);

    // Update persisted session to ended
    try {
      if (session.userUuid) {
        await db.update(voiceSessions)
          .set({
            endTime: endTime as unknown as Date,
            durationSeconds: duration,
            status: 'ended',
          })
          .where(eq(voiceSessions.id, session.id));
      } else {
        console.warn('⚠️ Skipping DB update on end: missing userUuid');
      }
    } catch (e) {
      console.warn('⚠️ Failed to update session end, continuing:', e);
    }

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    console.log(`✅ Ended voice session ${sessionId} - Duration: ${duration}s`);
    return session;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): VoiceSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions for a user (by token-derived id)
   */
  public getUserSessions(userId: string): VoiceSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Track voice usage for a user (keyed by uuid when available)
   */
  private async trackVoiceUsage(userKey: string, duration: number): Promise<void> {
    // Use Europe/Warsaw local date for daily aggregation
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date()); // YYYY-MM-DD (Warsaw local date)
    const key = `${userKey}_${today}`;
    
    let usage = this.userUsage.get(key);
    if (!usage) {
      usage = {
        userId: userKey,
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
   * Get user's daily voice usage (keyed by uuid when available)
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
          userId: userKey,
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
          userUuid: usage.userId,
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
        userId: row.userUuid,
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
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const sessionAge = now.getTime() - session.startTime.getTime();
      const maxSessionTime = 30 * 60 * 1000; // 30 minutes

      if (sessionAge > maxSessionTime) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      this.endSession(sessionId);
    });
  }

  /**
   * Get service statistics
   */
  public getServiceStats(): {
    activeSessions: number;
    totalUsers: number;
    avgSessionDuration: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    
    return {
      activeSessions: sessions.length,
      totalUsers: new Set(sessions.map(s => s.userId)).size,
      avgSessionDuration: sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0
    };
  }

  /**
   * Get all active sessions (admin use)
   */
  public getAllActiveSessions(): Array<Pick<VoiceSession, 'id' | 'userId' | 'userUuid' | 'userName' | 'conversationId' | 'agentId' | 'elevenLabsConversationId' | 'startTime' | 'status' | 'clientType' | 'duration'>> {
    const sessions = Array.from(this.activeSessions.values());
    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userUuid: s.userUuid,
      userName: s.userName,
      conversationId: s.conversationId,
      agentId: s.agentId,
      elevenLabsConversationId: s.elevenLabsConversationId,
      startTime: s.startTime,
      status: s.status,
      clientType: s.clientType,
      duration: s.duration,
    }));
  }

  /**
   * End all active sessions (admin use)
   */
  public async endAllActiveSessions(): Promise<{ ended: number; sessionIds: string[] }> {
    const ids = Array.from(this.activeSessions.keys());
    const endedIds: string[] = [];
    for (const id of ids) {
      const ended = await this.endSession(id);
      if (ended) endedIds.push(id);
    }
    return { ended: endedIds.length, sessionIds: endedIds };
  }
}

export const sessionManager = new VoiceSessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000);
