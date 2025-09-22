/**
 * ElevenLabs Service
 * Handles all interactions with ElevenLabs Conversational AI API
 */
// Ensure environment variables are loaded
import { config } from 'dotenv';
config();
import { agentManager } from '../config/agents.js';
import crypto from 'crypto';
class ElevenLabsService {
    apiKey;
    baseUrl = 'https://api.elevenlabs.io/v1';
    encryptionKey;
    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        if (!this.apiKey) {
            throw new Error('ELEVENLABS_API_KEY is required');
        }
        // Generate a consistent 32-byte encryption key for AES-256-GCM
        if (process.env.ENCRYPTION_KEY) {
            // Use provided key (must be 32 bytes)
            this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
            if (this.encryptionKey.length !== 32) {
                throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
            }
        }
        else {
            // Generate deterministic key from service name (for development)
            this.encryptionKey = crypto.createHash('sha256')
                .update('voice-service-encryption-key')
                .digest(); // This produces exactly 32 bytes
        }
    }
    /**
     * Get conversation token from ElevenLabs for a specific agent (legacy method)
     */
    async getConversationToken(agentId) {
        const agent = agentManager.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        console.log(`🔗 Getting ElevenLabs token for agent: ${agent.name} (${agent.agentId})`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`${this.baseUrl}/convai/conversation/token?agent_id=${agent.agentId}`, {
                method: 'GET',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ ElevenLabs API error: ${response.status} - ${errorText}`);
                throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            console.log(`✅ Successfully got conversation token for ${agent.name}`);
            return data.token;
        }
        catch (error) {
            console.error('❌ Failed to get ElevenLabs conversation token:', error);
            throw error;
        }
    }
    /**
     * Get conversation token (standard approach)
     * Overrides will be applied when the client starts the session
     */
    async getConversationTokenForOverrides(agentId) {
        // Use the standard token method - overrides are applied by client
        return this.getConversationToken(agentId);
    }
    /**
     * Encrypt ALL user data for maximum security transmission to client
     * Simple, clear AES-256-CBC encryption - transparent and reliable
     */
    encryptUserData(data) {
        try {
            // Use AES-256-CBC - simple, reliable, and well-supported
            const algorithm = 'aes-256-cbc';
            const iv = crypto.randomBytes(16); // 16 bytes IV for CBC
            // Create cipher with our 32-byte key and IV (modern approach)
            const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
            // Encrypt the JSON data
            const jsonData = JSON.stringify(data);
            let encrypted = cipher.update(jsonData, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Package everything together (simple and transparent)
            const encryptedPackage = {
                iv: iv.toString('hex'),
                encrypted: encrypted,
                timestamp: Date.now(), // For expiration checking
                algorithm: algorithm // For transparency
            };
            // Return as base64 string
            return Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
        }
        catch (error) {
            console.error('❌ Encryption failed:', error);
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Decrypt user data (used by Server Tools)
     * Simple, clear AES-256-CBC decryption - transparent and reliable
     */
    decryptUserData(encryptedData) {
        try {
            // Parse the encrypted package
            const encryptedPackage = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
            // Check if data has expired (1 hour max for security)
            const maxAge = 60 * 60 * 1000; // 1 hour
            if (Date.now() - encryptedPackage.timestamp > maxAge) {
                throw new Error('Encrypted data has expired (max age: 1 hour)');
            }
            // Verify algorithm matches (transparency)
            const algorithm = encryptedPackage.algorithm || 'aes-256-cbc';
            if (algorithm !== 'aes-256-cbc') {
                throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
            }
            // Extract IV
            const iv = Buffer.from(encryptedPackage.iv, 'hex');
            // Create decipher with our 32-byte key and IV (modern approach)
            const decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, iv);
            // Decrypt the data
            let decrypted = decipher.update(encryptedPackage.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            // Parse and return the original data
            return JSON.parse(decrypted);
        }
        catch (error) {
            console.error('❌ Decryption failed:', error);
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Prepare dynamic variables for ElevenLabs agent
     */
    prepareDynamicVariables(params) {
        const dynamicVariables = {
            user_id: params.userId,
            user_uuid: params.userUuid || params.userId, // Fallback to userId if no UUID
            user_name: params.userName,
            user_token: params.userToken,
            bearer_token: `Bearer ${params.userToken}`,
            conversation_id: params.conversationId,
        };
        // Validate all required variables are present
        const requiredVars = ['user_id', 'user_uuid', 'user_name', 'user_token', 'conversation_id'];
        const missingVars = requiredVars.filter(varName => !dynamicVariables[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required dynamic variables: ${missingVars.join(', ')}`);
        }
        console.log('✅ Prepared dynamic variables for ElevenLabs agent:', {
            ...dynamicVariables,
            user_token: dynamicVariables.user_token.substring(0, 10) + '...', // Hide full token in logs
        });
        return dynamicVariables;
    }
    /**
     * Start ElevenLabs conversation with OVERRIDES (BEST APPROACH)
     *
     * Uses ElevenLabs native Overrides feature. The client will apply overrides
     * when starting the WebRTC session, not when getting the token.
     */
    async startConversationWithOverrides(params) {
        console.log(`🎤 Starting ElevenLabs conversation with OVERRIDES for user: ${params.userName} with agent: ${params.agentId}`);
        try {
            // Prepare dynamic variables for overrides
            const dynamicVariables = this.prepareDynamicVariables(params);
            // Get standard conversation token
            const token = await this.getConversationTokenForOverrides(params.agentId);
            // Get agent info for response
            const agent = agentManager.getAgent(params.agentId);
            // Prepare overrides for client to use when starting session
            const overrides = {
                agent: {
                    prompt: {
                        prompt: `You are a helpful Polish voice assistant. The user's name is ${dynamicVariables.user_name} (ID: ${dynamicVariables.user_id}). Personalize your responses and greet them by name.`
                    },
                    firstMessage: `Cześć ${dynamicVariables.user_name}! Miło Cię poznać. W czym mogę Ci dzisiaj pomóc?`,
                    language: "pl" // Polish
                }
            };
            console.log(`🎯 Prepared overrides for client to apply when starting session`);
            console.log(`🚀 Agent will greet: "Cześć ${params.userName}!" when session starts`);
            // Return token + overrides for client to use
            return {
                token, // Standard WebRTC token
                agentId: agent.agentId, // Agent ID
                connectionType: 'webrtc', // Connection type
                overrides // Overrides for client to apply
            };
        }
        catch (error) {
            console.error('❌ Failed to start ElevenLabs conversation with overrides:', error);
            throw error;
        }
    }
    /**
     * Start ElevenLabs conversation SECURELY (no sensitive data to client)
     *
     * Following ElevenLabs best practices:
     * - Client gets WebRTC token for direct connection
     * - User context stored server-side for Server Tools
     * - Agent gets user context via API calls when needed
     */
    async startSecureConversation(params) {
        console.log(`🎤 Starting SECURE ElevenLabs conversation for user: ${params.userName} with agent: ${params.agentId}`);
        try {
            // Store dynamic variables server-side for Server Tools access
            const dynamicVariables = this.prepareDynamicVariables(params);
            // Store user context in memory for Server Tools to access
            // This will be used when the agent makes API calls back to our system
            this.storeUserContextForSession(params.conversationId, dynamicVariables);
            // Get secure conversation token (no variables sent to ElevenLabs yet)
            const token = await this.getConversationToken(params.agentId);
            // Get agent info for response
            const agent = agentManager.getAgent(params.agentId);
            // Prepare ALL user data for encryption (maximum security)
            const allUserData = {
                // User identification
                user_name: dynamicVariables.user_name,
                user_id: dynamicVariables.user_id,
                user_uuid: dynamicVariables.user_uuid,
                conversation_id: dynamicVariables.conversation_id,
                // Sensitive tokens
                bearer_token: dynamicVariables.bearer_token,
                user_token: dynamicVariables.user_token,
                // Agent info
                agentId: agent.agentId,
                agentName: agent.name
            };
            // Encrypt ALL user data
            const encryptedPayload = this.encryptUserData(allUserData);
            console.log(`🛡️ User context stored server-side for conversation: ${params.conversationId}`);
            console.log(`🔐 ALL user data encrypted - maximum security enabled`);
            // Return ONLY WebRTC token + ENCRYPTED payload
            return {
                token, // WebRTC token (only safe data exposed)
                agentId: 'encrypted', // Placeholder - real agentId is encrypted
                connectionType: 'webrtc', // Connection type (safe)
                encryptedPayload // ALL user data encrypted - client cannot read anything
            };
        }
        catch (error) {
            console.error('❌ Failed to start secure ElevenLabs conversation:', error);
            throw error;
        }
    }
    /**
     * Store user context server-side for Server Tools access
     * This allows the ElevenLabs agent to get user context via API calls
     */
    userContextStore = new Map();
    storeUserContextForSession(conversationId, variables) {
        this.userContextStore.set(conversationId, variables);
        console.log(`💾 Stored user context for conversation: ${conversationId}`);
        // Clean up after 1 hour to prevent memory leaks
        setTimeout(() => {
            this.userContextStore.delete(conversationId);
            console.log(`🧹 Cleaned up user context for conversation: ${conversationId}`);
        }, 60 * 60 * 1000);
    }
    /**
     * Get user context for a conversation (used by Server Tools)
     * This is called when the ElevenLabs agent needs user information
     */
    getUserContextForConversation(conversationId) {
        const context = this.userContextStore.get(conversationId);
        if (context) {
            console.log(`📋 Retrieved user context for conversation: ${conversationId}`);
            return context;
        }
        console.warn(`⚠️ No user context found for conversation: ${conversationId}`);
        return null;
    }
    /**
     * Start ElevenLabs conversation (DEPRECATED - use startSecureConversation)
     * @deprecated Use startSecureConversation instead for better security
     */
    async startConversation(params) {
        console.warn('⚠️ Using deprecated startConversation - use startSecureConversation for better security');
        console.log(`🎤 Starting ElevenLabs conversation for user: ${params.userName} with agent: ${params.agentId}`);
        try {
            // Get conversation token from ElevenLabs
            const token = await this.getConversationToken(params.agentId);
            // Prepare dynamic variables
            const dynamicVariables = this.prepareDynamicVariables(params);
            // Get agent info for response
            const agent = agentManager.getAgent(params.agentId);
            return {
                token,
                agentId: agent.agentId, // Return the actual ElevenLabs agent ID
                dynamicVariables,
                connectionType: 'webrtc',
            };
        }
        catch (error) {
            console.error('❌ Failed to start ElevenLabs conversation:', error);
            throw error;
        }
    }
    /**
     * Validate agent availability
     */
    validateAgent(agentId) {
        const agent = agentManager.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        if (!agent.isActive) {
            throw new Error(`Agent ${agentId} is not active`);
        }
        return agent;
    }
    /**
     * Get agent information
     */
    getAgentInfo(agentId) {
        return this.validateAgent(agentId);
    }
    /**
     * List all available agents
     */
    getAllAgents() {
        return agentManager.getAllAgents();
    }
    /**
     * Get agent by specialization
     */
    getAgentBySpecialization(specialization) {
        return agentManager.getAgentBySpecialization(specialization);
    }
    /**
     * Health check for ElevenLabs connectivity
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            // Try to get a token for the first available agent as a health check
            const agents = this.getAllAgents();
            if (agents.length === 0) {
                return { status: 'unhealthy', error: 'No agents configured' };
            }
            await this.getConversationToken(agents[0].id);
            const latency = Date.now() - startTime;
            return { status: 'healthy', latency };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
export const elevenLabsService = new ElevenLabsService();
//# sourceMappingURL=elevenlabs-service.js.map