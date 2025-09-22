/**
 * Voice API Controller
 * Handles all REST API endpoints for voice service
 */
import { Request, Response } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                name: string;
                token: string;
                uuid?: string;
            };
        }
    }
}
declare class VoiceController {
    /**
     * GET /api/voice/agents
     * List all available voice agents
     */
    getAgents(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/voice/agents/:agentId
     * Get specific agent information
     */
    getAgent(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/voice/conversations/start
     * Start a new voice conversation
     */
    startConversation(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/voice/conversations/:sessionId/end
     * End an active voice conversation
     */
    endConversation(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/voice/conversations/:sessionId/status
     * Get conversation status
     */
    getConversationStatus(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/voice/sessions/usage
     * Get user's voice usage statistics
     */
    getUserVoiceUsage(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/voice/sessions/active
     * Get user's active sessions
     */
    getUserActiveSessions(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/voice/health
     * Health check endpoint
     */
    healthCheck(req: Request, res: Response): Promise<void>;
    /**
     * Server Tools endpoint: Get user context for ElevenLabs agents
     * This endpoint is called by ElevenLabs agents via Server Tools
     * when they need user information during conversations
     */
    getUserContext(req: Request, res: Response): Promise<void>;
    /**
     * Server Tools endpoint: Decrypt user context for ElevenLabs agents
     * This endpoint decrypts the encrypted user context sent by clients
     */
    decryptUserContext(req: Request, res: Response): Promise<void>;
    /**
     * Server Tools endpoint: Make authenticated API calls for ElevenLabs agents
     * This endpoint allows agents to make API calls using stored user tokens
     */
    makeAuthenticatedCall(req: Request, res: Response): Promise<void>;
}
export declare const voiceController: VoiceController;
export {};
//# sourceMappingURL=voice-controller.d.ts.map