/**
 * ElevenLabs Service
 * Handles all interactions with ElevenLabs Conversational AI API
 */
import { VoiceAgent } from '../config/agents.js';
interface ConversationStartParams {
    agentId: string;
    userId: string;
    userName: string;
    userToken: string;
    conversationId: string;
    userUuid?: string;
}
interface SecureConversationResponse {
    token: string;
    agentId: string;
    connectionType: 'webrtc';
    encryptedPayload?: string;
}
interface OverridesConversationResponse {
    token: string;
    agentId: string;
    connectionType: 'webrtc';
    overrides: any;
}
interface DynamicVariables {
    user_id: string;
    user_uuid: string;
    user_name: string;
    user_token: string;
    bearer_token: string;
    conversation_id: string;
}
declare class ElevenLabsService {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly encryptionKey;
    constructor();
    /**
     * Get conversation token from ElevenLabs for a specific agent (legacy method)
     */
    getConversationToken(agentId: string): Promise<string>;
    /**
     * Get conversation token (standard approach)
     * Overrides will be applied when the client starts the session
     */
    getConversationTokenForOverrides(agentId: string): Promise<string>;
    /**
     * Encrypt ALL user data for maximum security transmission to client
     * Simple, clear AES-256-CBC encryption - transparent and reliable
     */
    private encryptUserData;
    /**
     * Decrypt user data (used by Server Tools)
     * Simple, clear AES-256-CBC decryption - transparent and reliable
     */
    decryptUserData(encryptedData: string): any;
    /**
     * Prepare dynamic variables for ElevenLabs agent
     */
    prepareDynamicVariables(params: ConversationStartParams): DynamicVariables;
    /**
     * Start ElevenLabs conversation with OVERRIDES (BEST APPROACH)
     *
     * Uses ElevenLabs native Overrides feature. The client will apply overrides
     * when starting the WebRTC session, not when getting the token.
     */
    startConversationWithOverrides(params: ConversationStartParams): Promise<OverridesConversationResponse>;
    /**
     * Start ElevenLabs conversation SECURELY (no sensitive data to client)
     *
     * Following ElevenLabs best practices:
     * - Client gets WebRTC token for direct connection
     * - User context stored server-side for Server Tools
     * - Agent gets user context via API calls when needed
     */
    startSecureConversation(params: ConversationStartParams): Promise<SecureConversationResponse>;
    /**
     * Store user context server-side for Server Tools access
     * This allows the ElevenLabs agent to get user context via API calls
     */
    private userContextStore;
    private storeUserContextForSession;
    /**
     * Get user context for a conversation (used by Server Tools)
     * This is called when the ElevenLabs agent needs user information
     */
    getUserContextForConversation(conversationId: string): DynamicVariables | null;
    /**
     * Start ElevenLabs conversation (DEPRECATED - use startSecureConversation)
     * @deprecated Use startSecureConversation instead for better security
     */
    startConversation(params: ConversationStartParams): Promise<{
        token: string;
        agentId: string;
        dynamicVariables: DynamicVariables;
        connectionType: 'webrtc';
    }>;
    /**
     * Validate agent availability
     */
    validateAgent(agentId: string): VoiceAgent;
    /**
     * Get agent information
     */
    getAgentInfo(agentId: string): VoiceAgent;
    /**
     * List all available agents
     */
    getAllAgents(): VoiceAgent[];
    /**
     * Get agent by specialization
     */
    getAgentBySpecialization(specialization: string): VoiceAgent | null;
    /**
     * Health check for ElevenLabs connectivity
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency?: number;
        error?: string;
    }>;
}
export declare const elevenLabsService: ElevenLabsService;
export {};
//# sourceMappingURL=elevenlabs-service.d.ts.map