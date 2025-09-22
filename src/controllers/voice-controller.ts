/**
 * Voice API Controller
 * Handles all REST API endpoints for voice service
 */

import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../services/session-manager.js';
import { elevenLabsService } from '../services/elevenlabs-service.js';
import { agentManager } from '../config/agents.js';

// Extend Request interface to include user context
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

class VoiceController {

  /**
   * GET /api/voice/agents
   * List all available voice agents
   */
  public async getAgents(req: Request, res: Response): Promise<void> {
    try {
      const agents = elevenLabsService.getAllAgents();
      
      res.json({
        success: true,
        data: {
          agents,
          total: agents.length
        }
      });
    } catch (error) {
      console.error('❌ Error getting agents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
      
      res.json({
        success: true,
        data: { agent }
      });
    } catch (error) {
      console.error('❌ Error getting agent:', error);
      res.status(404).json({
        success: false,
        error: 'Agent not found',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(400).json({
          success: false,
          error: 'Missing required fields: agentId, conversationId'
        });
        return;
      }

      // Validate agent
      elevenLabsService.validateAgent(agentId);

      // Create voice session
      const session = await sessionManager.createSession({
        userId: user.id,
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
        userId: user.id,
        userName: user.name,
        userToken: user.token,    // Used for overrides - embedded in WebRTC token
        conversationId,
        userUuid: user.uuid
      });

      // Update session with ElevenLabs conversation ID
      sessionManager.updateSessionWithElevenLabsId(session.id, conversationData.token);

      // Return response with overrides for client to apply when starting session
      res.status(201).json({
        success: true,
        data: {
          sessionId: session.id,
          conversationData: {
            token: conversationData.token,           // ✅ Standard WebRTC token
            agentId: conversationData.agentId,       // ✅ Agent ID
            connectionType: conversationData.connectionType, // ✅ Connection type
            overrides: conversationData.overrides   // ✅ Overrides for client to apply
          },
          session: {
            id: session.id,
            userId: session.userId,   // Safe to show
            agentId: session.agentId, // Safe to show
            status: session.status,
            startTime: session.startTime
          }
        }
      });

    } catch (error) {
      console.error('❌ Error starting conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      if (session.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this session'
        });
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

      res.json({
        success: true,
        data: {
          session: {
            id: endedSession.id,
            duration: endedSession.duration,
            startTime: endedSession.startTime,
            endTime: endedSession.endTime,
            status: endedSession.status
          }
        }
      });

    } catch (error) {
      console.error('❌ Error ending conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to end conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      if (session.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this session'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            status: session.status,
            duration: session.duration,
            startTime: session.startTime,
            agentId: session.agentId,
            clientType: session.clientType
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting conversation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/voice/sessions/usage
   * Get user's voice usage statistics
   */
  public async getUserVoiceUsage(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const usage = await sessionManager.getUserDailyUsage(user.id);

      res.json({
        success: true,
        data: {
          usage: {
            totalDuration: usage.totalDuration,
            sessionCount: usage.sessionCount,
            limit: usage.limit,
            remainingTime: Math.max(0, usage.limit - usage.totalDuration),
            isLimitReached: usage.isLimitReached,
            date: usage.date
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting voice usage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get voice usage',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/voice/sessions/active
   * Get user's active sessions
   */
  public async getUserActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const sessions = sessionManager.getUserSessions(user.id);

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            agentId: session.agentId,
            status: session.status,
            duration: session.duration,
            startTime: session.startTime,
            clientType: session.clientType
          })),
          total: sessions.length
        }
      });

    } catch (error) {
      console.error('❌ Error getting active sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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

      res.json({
        success: true,
        data: {
          status: overallHealth,
          timestamp: new Date().toISOString(),
          services: {
            elevenlabs: elevenLabsHealth,
            sessions: {
              status: 'healthy',
              stats: serviceStats
            }
          }
        }
      });

    } catch (error) {
      console.error('❌ Health check error:', error);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(400).json({
          success: false,
          error: 'Missing conversationId parameter'
        });
        return;
      }

      // Get user context from ElevenLabs service
      const userContext = elevenLabsService.getUserContextForConversation(conversationId);
      
      if (!userContext) {
        res.status(404).json({
          success: false,
          error: 'User context not found for conversation',
          conversationId
        });
        return;
      }

      // Return safe user context (excluding sensitive tokens)
      const safeContext = {
        user_name: userContext.user_name,
        user_id: userContext.user_id,
        user_uuid: userContext.user_uuid,
        conversation_id: userContext.conversation_id
        // bearer_token and user_token excluded for security
      };

      console.log(`🔧 Server Tools: Provided user context for conversation ${conversationId}`);

      res.status(200).json({
        success: true,
        data: {
          userContext: safeContext,
          message: `Hello ${userContext.user_name}! I have your context now.`
        }
      });

    } catch (error) {
      console.error('❌ Error getting user context for Server Tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user context',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(400).json({
          success: false,
          error: 'Missing encryptedData parameter'
        });
        return;
      }

      // Decrypt the user context
      const decryptedData = elevenLabsService.decryptUserData(encryptedData);

      console.log(`🔓 Server Tools: Decrypted user context for conversation`);

      res.status(200).json({
        success: true,
        data: {
          decryptedContext: decryptedData,
          message: `Decrypted user context successfully`
        }
      });

    } catch (error) {
      console.error('❌ Error decrypting user context for Server Tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to decrypt user context',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: conversationId, endpoint'
        });
        return;
      }

      // Get user context with tokens
      const userContext = elevenLabsService.getUserContextForConversation(conversationId);
      
      if (!userContext) {
        res.status(404).json({
          success: false,
          error: 'User context not found for conversation'
        });
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

      res.status(200).json({
        success: true,
        data: {
          response: result,
          status: response.status,
          endpoint
        }
      });

    } catch (error) {
      console.error('❌ Error making authenticated API call for Server Tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to make authenticated API call',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const voiceController = new VoiceController();
