/**
 * Voice Session Manager
 * Manages conversation sessions, state, and usage tracking
 */
class VoiceSessionManager {
    activeSessions = new Map();
    userUsage = new Map();
    DAILY_LIMIT_SECONDS = parseInt(process.env.VOICE_TIME_LIMIT || '600', 10);
    /**
     * Create a new voice session
     */
    async createSession(params) {
        // Check daily usage limit
        const usage = await this.getUserDailyUsage(params.userId);
        if (usage.isLimitReached) {
            throw new Error('Daily voice usage limit reached');
        }
        const session = {
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
    updateSessionWithElevenLabsId(sessionId, elevenLabsConversationId) {
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
    async endSession(sessionId) {
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
    getSession(sessionId) {
        return this.activeSessions.get(sessionId) || null;
    }
    /**
     * Get all active sessions for a user
     */
    getUserSessions(userId) {
        return Array.from(this.activeSessions.values())
            .filter(session => session.userId === userId);
    }
    /**
     * Track voice usage for a user
     */
    async trackVoiceUsage(userId, duration) {
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
    async getUserDailyUsage(userId) {
        const today = new Date().toDateString();
        const key = `${userId}_${today}`;
        let usage = this.userUsage.get(key);
        if (!usage) {
            // Load from database if not in memory
            usage = await this.loadUsageFromDatabase(userId, today) ?? undefined;
            if (usage) {
                this.userUsage.set(key, usage);
            }
            else {
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
    generateSessionId() {
        return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Persist usage to database (implement based on your DB)
     */
    async persistUsageToDatabase(usage) {
        // Implementation depends on your database choice
        // Could be Supabase, PostgreSQL, MongoDB, etc.
        console.log(`💾 Persisting usage for ${usage.userId}: ${usage.totalDuration}s`);
    }
    /**
     * Load usage from database
     */
    async loadUsageFromDatabase(userId, date) {
        // Implementation depends on your database choice
        console.log(`📊 Loading usage for ${userId} on ${date}`);
        return null;
    }
    /**
     * Cleanup expired sessions (run periodically)
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredSessions = [];
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
    getServiceStats() {
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
//# sourceMappingURL=session-manager.js.map