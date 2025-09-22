/**
 * Voice Service API Routes
 * Defines all REST endpoints for the voice service
 */
import express from 'express';
import { voiceController } from '../controllers/voice-controller.js';
import { authenticateUser, optionalAuth, rateLimit } from '../middleware/auth.js';
const router = express.Router();
// Apply rate limiting to all routes
router.use(rateLimit(200, 15 * 60 * 1000)); // 200 requests per 15 minutes
/**
 * Agent Management Routes
 */
// GET /api/voice/agents - List all available agents
router.get('/agents', optionalAuth, voiceController.getAgents.bind(voiceController));
// GET /api/voice/agents/:agentId - Get specific agent information
router.get('/agents/:agentId', optionalAuth, voiceController.getAgent.bind(voiceController));
/**
 * Conversation Management Routes
 */
// POST /api/voice/conversations/start - Start new conversation
router.post('/conversations/start', authenticateUser, voiceController.startConversation.bind(voiceController));
// POST /api/voice/conversations/:sessionId/end - End conversation
router.post('/conversations/:sessionId/end', authenticateUser, voiceController.endConversation.bind(voiceController));
// GET /api/voice/conversations/:sessionId/status - Get conversation status
router.get('/conversations/:sessionId/status', authenticateUser, voiceController.getConversationStatus.bind(voiceController));
/**
 * Session Management Routes
 */
// GET /api/voice/sessions/usage - Get user's voice usage statistics
router.get('/sessions/usage', authenticateUser, voiceController.getUserVoiceUsage.bind(voiceController));
// GET /api/voice/sessions/active - Get user's active sessions
router.get('/sessions/active', authenticateUser, voiceController.getUserActiveSessions.bind(voiceController));
/**
 * Health & Monitoring Routes
 */
// GET /api/voice/health - Service health check
router.get('/health', voiceController.healthCheck.bind(voiceController));
/**
 * Server Tools Routes (for ElevenLabs agents)
 * These endpoints are called by ElevenLabs agents via Server Tools
 * No authentication required as they're called from ElevenLabs servers
 */
// GET /api/voice/tools/user-context/:conversationId - Get user context for conversation
router.get('/tools/user-context/:conversationId', voiceController.getUserContext.bind(voiceController));
// POST /api/voice/tools/decrypt - Decrypt encrypted user context
router.post('/tools/decrypt', voiceController.decryptUserContext.bind(voiceController));
// POST /api/voice/tools/authenticated-call/:conversationId - Make authenticated API calls
router.post('/tools/authenticated-call/:conversationId', voiceController.makeAuthenticatedCall.bind(voiceController));
/**
 * API Documentation Route
 */
router.get('/', (req, res) => {
    res.json({
        service: 'Voice Service API',
        version: '1.0.0',
        description: 'ElevenLabs Voice Conversation API for multi-client consumption',
        endpoints: {
            agents: {
                'GET /api/voice/agents': 'List all available agents',
                'GET /api/voice/agents/:agentId': 'Get specific agent information'
            },
            conversations: {
                'POST /api/voice/conversations/start': 'Start new conversation',
                'POST /api/voice/conversations/:sessionId/end': 'End conversation',
                'GET /api/voice/conversations/:sessionId/status': 'Get conversation status'
            },
            sessions: {
                'GET /api/voice/sessions/usage': 'Get voice usage statistics',
                'GET /api/voice/sessions/active': 'Get active sessions'
            },
            health: {
                'GET /api/voice/health': 'Service health check'
            },
            serverTools: {
                'GET /api/voice/tools/user-context/:conversationId': 'Get user context for ElevenLabs agents',
                'POST /api/voice/tools/authenticated-call/:conversationId': 'Make authenticated API calls for agents'
            }
        },
        authentication: {
            methods: [
                'X-API-TOKEN header (preferred)',
                'Authorization: Bearer <token>',
                'Environment API_KEY (fallback)'
            ],
            example: {
                'X-API-TOKEN': '1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6'
            }
        },
        agents: {
            available: [
                'agent_1 - Support Agent Florek',
                'agent_2 - Diet Expert Agent',
                'agent_3 - Sales Agent',
                'agent_4 - Technical Support Agent'
            ]
        },
        rateLimit: {
            limit: 200,
            windowMs: 15 * 60 * 1000,
            description: '200 requests per 15 minutes'
        }
    });
});
export { router as voiceRoutes };
//# sourceMappingURL=voice-routes.js.map