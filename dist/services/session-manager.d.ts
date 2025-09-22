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
declare class VoiceSessionManager {
    private activeSessions;
    private userUsage;
    private readonly DAILY_LIMIT_SECONDS;
    /**
     * Create a new voice session
     */
    createSession(params: {
        userId: string;
        userName: string;
        userToken: string;
        conversationId: string;
        agentId: string;
        clientType: 'web' | 'flutter' | 'mobile';
        metadata?: Record<string, any>;
    }): Promise<VoiceSession>;
    /**
     * Update session with ElevenLabs conversation ID
     */
    updateSessionWithElevenLabsId(sessionId: string, elevenLabsConversationId: string): void;
    /**
     * End a voice session and track usage
     */
    endSession(sessionId: string): Promise<VoiceSession | null>;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): VoiceSession | null;
    /**
     * Get all active sessions for a user
     */
    getUserSessions(userId: string): VoiceSession[];
    /**
     * Track voice usage for a user
     */
    private trackVoiceUsage;
    /**
     * Get user's daily voice usage
     */
    getUserDailyUsage(userId: string): Promise<UserVoiceUsage>;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
    /**
     * Persist usage to database (implement based on your DB)
     */
    private persistUsageToDatabase;
    /**
     * Load usage from database
     */
    private loadUsageFromDatabase;
    /**
     * Cleanup expired sessions (run periodically)
     */
    cleanupExpiredSessions(): void;
    /**
     * Get service statistics
     */
    getServiceStats(): {
        activeSessions: number;
        totalUsers: number;
        avgSessionDuration: number;
    };
}
export declare const sessionManager: VoiceSessionManager;
export {};
//# sourceMappingURL=session-manager.d.ts.map