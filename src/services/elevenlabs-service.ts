/**
 * ElevenLabs Service
 * Handles all interactions with ElevenLabs Conversational AI API
 */

// Ensure environment variables are loaded
import { config } from 'dotenv';
config();

import { agentManager, VoiceAgent } from '../config/agents.js';

interface ElevenLabsTokenResponse {
  token: string;
}

interface ConversationStartParams {
  agentId: string;
  userId: string;
  userName: string;
  userToken: string;
  conversationId: string;
  userUuid?: string;
}

interface DynamicVariables {
  user_id: string;
  user_uuid: string;
  user_name: string;
  user_token: string;
  bearer_token: string;
  conversation_id: string;
}

class ElevenLabsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY!;
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required');
    }
  }

  /**
   * Get conversation token from ElevenLabs for a specific agent
   */
  public async getConversationToken(agentId: string): Promise<string> {
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    console.log(`🔗 Getting ElevenLabs token for agent: ${agent.name} (${agent.agentId})`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${this.baseUrl}/convai/conversation/token?agent_id=${agent.agentId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ElevenLabs API error: ${response.status} - ${errorText}`);
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as ElevenLabsTokenResponse;
      console.log(`✅ Successfully got conversation token for ${agent.name}`);
      return data.token;

    } catch (error) {
      console.error('❌ Failed to get ElevenLabs conversation token:', error);
      throw error;
    }
  }

  /**
   * Prepare dynamic variables for ElevenLabs agent
   */
  public prepareDynamicVariables(params: ConversationStartParams): DynamicVariables {
    const dynamicVariables: DynamicVariables = {
      user_id: params.userId,
      user_uuid: params.userUuid || params.userId, // Fallback to userId if no UUID
      user_name: params.userName,
      user_token: params.userToken,
      bearer_token: `Bearer ${params.userToken}`,
      conversation_id: params.conversationId,
    };

    // Validate all required variables are present
    const requiredVars = ['user_id', 'user_uuid', 'user_name', 'user_token', 'conversation_id'];
    const missingVars = requiredVars.filter(varName => !dynamicVariables[varName as keyof DynamicVariables]);
    
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
   * Start ElevenLabs conversation
   * Returns the conversation data needed by clients
   */
  public async startConversation(params: ConversationStartParams): Promise<{
    token: string;
    agentId: string;
    dynamicVariables: DynamicVariables;
    connectionType: 'webrtc';
  }> {
    console.log(`🎤 Starting ElevenLabs conversation for user: ${params.userName} with agent: ${params.agentId}`);

    try {
      // Get conversation token from ElevenLabs
      const token = await this.getConversationToken(params.agentId);

      // Prepare dynamic variables
      const dynamicVariables = this.prepareDynamicVariables(params);

      // Get agent info for response
      const agent = agentManager.getAgent(params.agentId)!;

      return {
        token,
        agentId: agent.agentId, // Return the actual ElevenLabs agent ID
        dynamicVariables,
        connectionType: 'webrtc' as const,
      };

    } catch (error) {
      console.error('❌ Failed to start ElevenLabs conversation:', error);
      throw error;
    }
  }

  /**
   * Validate agent availability
   */
  public validateAgent(agentId: string): VoiceAgent {
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
  public getAgentInfo(agentId: string): VoiceAgent {
    return this.validateAgent(agentId);
  }

  /**
   * List all available agents
   */
  public getAllAgents(): VoiceAgent[] {
    return agentManager.getAllAgents();
  }

  /**
   * Get agent by specialization
   */
  public getAgentBySpecialization(specialization: string): VoiceAgent | null {
    return agentManager.getAgentBySpecialization(specialization);
  }

  /**
   * Health check for ElevenLabs connectivity
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
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

    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
