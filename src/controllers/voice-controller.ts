/**
 * Voice API Controller
 * Handles all REST API endpoints for voice service
 */

import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../services/session-manager.js';
import { elevenLabsService } from '../services/elevenlabs-service.js';
import { agentManager } from '../config/agents.js';
import { errorResponse, okResponse } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import { fetchUserMe } from '../middleware/auth.js';

// Extend Request interface to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        name: string;
        token: string;
        uuid?: string;
      };
    }
  }
}

class VoiceController {

  /**
   * GET /api/voice/agents
   * List all available voice agents
   */
  public async getAgents(req: Request, res: Response): Promise<void> {
    try {
      const agents = elevenLabsService.getAllAgents();
      
      res.json(okResponse({ agents, total: agents.length }));
    } catch (error) {
      logger.error('getAgents_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to get agents'));
    }
  }

  /**
   * GET /api/voice/agents/:agentId
   * Get specific agent information
   */
  public async getAgent(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const agent = elevenLabsService.getAgentInfo(agentId);
      
      res.json(okResponse({ agent }));
    } catch (error) {
      logger.warn('getAgent_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(404).json(errorResponse(404, 'Agent not found'));
    }
  }

  /**
   * POST /api/voice/conversations/start
   * Start a new voice conversation
   */
  public async startConversation(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!; // Ensured by auth middleware
      const { 
        agentId, 
        conversationId, 
        clientType = 'web',
        metadata 
      } = req.body;

      // Validate required fields
      if (!agentId || !conversationId) {
        res.status(400).json(errorResponse(400, 'Missing required fields: agentId, conversationId'));
        return;
      }

      // Validate agent
      elevenLabsService.validateAgent(agentId);

      // Create voice session (pass uuid for DB FK)
      const session = await sessionManager.createSession({
        userUuid: user.uuid!,
        userName: user.name,
        userToken: user.token,
        conversationId,
        agentId,
        clientType,
        metadata
      });

      // Start ElevenLabs conversation with OVERRIDES (BEST APPROACH)
      const conversationData = await elevenLabsService.startConversationWithOverrides({
        agentId,
        userName: user.name,
        userToken: user.token,    // Used for overrides - embedded in WebRTC token
        conversationId,
        userUuid: user.uuid!
      });

      // Update session with ElevenLabs conversation ID
      sessionManager.updateSessionWithElevenLabsId(session.id, conversationData.token);

      // Return response with overrides for client to apply when starting session
      res.status(201).json(okResponse({
        sessionId: session.id,
        conversationData: {
          token: conversationData.token,
          agentId: conversationData.agentId,
          connectionType: conversationData.connectionType,
          overrides: conversationData.overrides
        },
        session: {
          id: session.id,
          agentId: session.agentId,
          status: session.status,
          startTime: session.startTime
        }
      }));

    } catch (error) {
      logger.error('startConversation_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to start conversation'));
    }
  }

  /**
   * POST /api/voice/conversations/:sessionId/end
   * End an active voice conversation
   */
  public async endConversation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const user = req.user!;

      // Get session and validate ownership
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json(errorResponse(404, 'Session not found'));
        return;
      }

      if (session.userUuid !== user.uuid) {
        res.status(403).json(errorResponse(403, 'Access denied to this session'));
        return;
      }

      // End the session
      const endedSession = await sessionManager.endSession(sessionId);

      if (!endedSession) {
        res.status(404).json({
          success: false,
          error: 'Session not found or already ended'
        });
        return;
      }

      res.json(okResponse({
        session: {
          id: endedSession.id,
          duration: endedSession.duration,
          startTime: endedSession.startTime,
          endTime: endedSession.endTime,
          status: endedSession.status
        }
      }));

    } catch (error) {
      logger.error('endConversation_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to end conversation'));
    }
  }

  /**
   * GET /api/voice/conversations/:sessionId/status
   * Get conversation status
   */
  public async getConversationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const user = req.user!;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json(errorResponse(404, 'Session not found'));
        return;
      }

      if (session.userUuid !== user.uuid) {
        res.status(403).json(errorResponse(403, 'Access denied to this session'));
        return;
      }

      res.json(okResponse({
        session: {
          id: session.id,
          status: session.status,
          duration: session.duration,
          startTime: session.startTime,
          agentId: session.agentId,
          clientType: session.clientType
        }
      }));

    } catch (error) {
      logger.error('getConversationStatus_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to get conversation status'));
    }
  }

  /**
   * GET /api/voice/sessions/usage
   * Get user's voice usage statistics
   */
  public async getUserVoiceUsage(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const userKey = user.uuid!;
      const usage = await sessionManager.getUserDailyUsage(userKey);

      res.json(okResponse({
        usage: {
          totalDuration: usage.totalDuration,
          sessionCount: usage.sessionCount,
          limit: usage.limit,
          remainingTime: Math.max(0, usage.limit - usage.totalDuration),
          isLimitReached: usage.isLimitReached,
          date: usage.date
        }
      }));

    } catch (error) {
      logger.error('getUserVoiceUsage_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to get voice usage'));
    }
  }

  /**
   * GET /api/voice/sessions/active
   * Get user's active sessions
   */
  public async getUserActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const sessions = sessionManager.getUserSessions(user.uuid!);

      res.json(okResponse({
        sessions: sessions.map(session => ({
          id: session.id,
          agentId: session.agentId,
          status: session.status,
          duration: session.duration,
          startTime: session.startTime,
          clientType: session.clientType
        })),
        total: sessions.length
      }));

    } catch (error) {
      logger.error('getUserActiveSessions_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to get active sessions'));
    }
  }

  /**
   * GET /api/voice/health
   * Health check endpoint
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const elevenLabsHealth = await elevenLabsService.healthCheck();
      const serviceStats = sessionManager.getServiceStats();

      const overallHealth = elevenLabsHealth.status === 'healthy' ? 'healthy' : 'unhealthy';

      res.json(okResponse({
        status: overallHealth,
        timestamp: new Date().toISOString(),
        services: {
          elevenlabs: elevenLabsHealth,
          sessions: {
            status: 'healthy',
            stats: serviceStats
          }
        }
      }));

    } catch (error) {
      logger.error('healthCheck_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(503).json(errorResponse(503, 'Health check failed'));
    }
  }

  /**
   * GET /api/voice/rekeep/me
   * Test connectivity with ReKeep API and return uuid
   */
  public async rekeepMe(req: Request, res: Response): Promise<void> {
    try {
      const token = (req.headers['x-api-token'] as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : undefined);
      if (!token) {
        res.status(400).json({ success: false, error: 'Missing token. Provide X-API-TOKEN or Authorization: Bearer' });
        return;
      }
      const me = await fetchUserMe(token);
      if (!me?.data?.uuid) {
        res.status(502).json({ success: false, error: 'Failed to fetch uuid from ReKeep' });
        return;
      }
      res.json({ success: true, data: { uuid: me.data.uuid, first_name: me.data.client_profile?.first_name, last_name: me.data.client_profile?.last_name } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'ReKeep check failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Server Tools endpoint: Get user context for ElevenLabs agents
   * This endpoint is called by ElevenLabs agents via Server Tools
   * when they need user information during conversations
   */
  public async getUserContext(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
      res.status(400).json(errorResponse(400, 'Missing conversationId parameter'));
        return;
      }

      // Get user context from ElevenLabs service
      const userContext = elevenLabsService.getUserContextForConversation(conversationId);
      
      if (!userContext) {
        res.status(404).json(errorResponse(404, 'User context not found for conversation'));
        return;
      }

      // Return safe user context (excluding sensitive tokens)
      const safeContext = {
        user_name: userContext.user_name,
        user_uuid: userContext.user_uuid,
        conversation_id: userContext.conversation_id
        // bearer_token and user_token excluded for security
      };

      console.log(`🔧 Server Tools: Provided user context for conversation ${conversationId}`);

      res.status(200).json(okResponse({ userContext: safeContext, message: `Hello ${userContext.user_name}! I have your context now.` }));

    } catch (error) {
      logger.error('getUserContext_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to get user context'));
    }
  }

  /**
   * Server Tools endpoint: Decrypt user context for ElevenLabs agents
   * This endpoint decrypts the encrypted user context sent by clients
   */
  public async decryptUserContext(req: Request, res: Response): Promise<void> {
    try {
      const { encryptedData } = req.body;
      
      if (!encryptedData) {
      res.status(400).json(errorResponse(400, 'Missing encryptedData parameter'));
        return;
      }

      // Decrypt the user context
      const decryptedData = elevenLabsService.decryptUserData(encryptedData);

      console.log(`🔓 Server Tools: Decrypted user context for conversation`);

      res.status(200).json(okResponse({ decryptedContext: decryptedData, message: 'Decrypted user context successfully' }));

    } catch (error) {
      logger.error('decryptUserContext_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to decrypt user context'));
    }
  }

  /**
   * Server Tools endpoint: Make authenticated API calls for ElevenLabs agents
   * This endpoint allows agents to make API calls using stored user tokens
   */
  public async makeAuthenticatedCall(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { endpoint, method = 'GET', data } = req.body;
      
      if (!conversationId || !endpoint) {
      res.status(400).json(errorResponse(400, 'Missing required parameters: conversationId, endpoint'));
        return;
      }

      // Get user context with tokens
      const userContext = elevenLabsService.getUserContextForConversation(conversationId);
      
      if (!userContext) {
        res.status(404).json(errorResponse(404, 'User context not found for conversation'));
        return;
      }

      // Make authenticated API call using stored bearer token
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': userContext.bearer_token,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();

      console.log(`🔧 Server Tools: Made authenticated API call for conversation ${conversationId} to ${endpoint}`);

      res.status(200).json(okResponse({ response: result, status: response.status, endpoint }));

    } catch (error) {
      logger.error('makeAuthenticatedCall_error', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json(errorResponse(500, 'Failed to make authenticated API call'));
    }
  }
}

export const voiceController = new VoiceController();
