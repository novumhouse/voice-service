/**
 * Voice Session Manager
 * Manages conversation sessions, state, and usage tracking
 */

interface VoiceSession {
  id: string;
  userId: string;
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
  userId: string;
  date: string;
  totalDuration: number;
  sessionCount: number;
  limit: number;
  isLimitReached: boolean;
}

class VoiceSessionManager {
  private activeSessions: Map<string, VoiceSession> = new Map();
  private userUsage: Map<string, UserVoiceUsage> = new Map();
  private readonly DAILY_LIMIT_SECONDS = parseInt(process.env.VOICE_TIME_LIMIT || '600', 10);

  /**
   * Create a new voice session
   */
  public async createSession(params: {
    userId: string;
    userName: string;
    userToken: string;
    conversationId: string;
    agentId: string;
    clientType: 'web' | 'flutter' | 'mobile';
    metadata?: Record<string, any>;
  }): Promise<VoiceSession> {
    
    // Check daily usage limit
    const usage = await this.getUserDailyUsage(params.userId);
    if (usage.isLimitReached) {
      throw new Error('Daily voice usage limit reached');
    }

    const session: VoiceSession = {
      id: this.generateSessionId(),
      userId: params.userId,
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
    
    console.log(`📱 Created voice session ${session.id} for user ${params.userId} (${params.clientType})`);
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

    // Track usage
    await this.trackVoiceUsage(session.userId, duration);

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
   * Get all active sessions for a user
   */
  public getUserSessions(userId: string): VoiceSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }

  /**
   * Track voice usage for a user
   */
  private async trackVoiceUsage(userId: string, duration: number): Promise<void> {
    const today = new Date().toDateString();
    const key = `${userId}_${today}`;
    
    let usage = this.userUsage.get(key);
    if (!usage) {
      usage = {
        userId,
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

    // Persist to database (implement based on your DB choice)
    await this.persistUsageToDatabase(usage);
  }

  /**
   * Get user's daily voice usage
   */
  public async getUserDailyUsage(userId: string): Promise<UserVoiceUsage> {
    const today = new Date().toDateString();
    const key = `${userId}_${today}`;
    
    let usage = this.userUsage.get(key);
    if (!usage) {
      // Load from database if not in memory
      usage = await this.loadUsageFromDatabase(userId, today) ?? undefined;
      if (usage) {
        this.userUsage.set(key, usage);
      } else {
        usage = {
          userId,
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
   * Persist usage to database (implement based on your DB)
   */
  private async persistUsageToDatabase(usage: UserVoiceUsage): Promise<void> {
    // Implementation depends on your database choice
    // Could be Supabase, PostgreSQL, MongoDB, etc.
    console.log(`💾 Persisting usage for ${usage.userId}: ${usage.totalDuration}s`);
  }

  /**
   * Load usage from database
   */
  private async loadUsageFromDatabase(userId: string, date: string): Promise<UserVoiceUsage | null> {
    // Implementation depends on your database choice
    console.log(`📊 Loading usage for ${userId} on ${date}`);
    return null;
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
}

export const sessionManager = new VoiceSessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000);
