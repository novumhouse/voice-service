/**
 * Web Client Example for Voice Service API
 * TypeScript/JavaScript implementation
 */

interface VoiceAgent {
  id: string;
  agentId: string;
  name: string;
  description: string;
  language: string;
  specialization: string;
  isActive: boolean;
}

interface VoiceSession {
  id: string;
  userId: string;
  agentId: string;
  status: string;
  startTime: string;
  clientType: string;
}

interface VoiceUsage {
  totalDuration: number;
  sessionCount: number;
  limit: number;
  remainingTime: number;
  isLimitReached: boolean;
  date: string;
}

class VoiceServiceClient {
  private baseUrl: string;
  private userToken: string;
  private conversation: any; // ElevenLabs conversation object

  constructor(baseUrl: string, userToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.userToken = userToken;
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-TOKEN': this.userToken
    };
  }

  /**
   * Make API request with error handling
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get list of available voice agents
   */
  async getAgents(): Promise<VoiceAgent[]> {
    const response = await this.makeRequest<{ success: boolean; data: { agents: VoiceAgent[] } }>('/api/voice/agents');
    return response.data.agents;
  }

  /**
   * Get specific agent information
   */
  async getAgent(agentId: string): Promise<VoiceAgent> {
    const response = await this.makeRequest<{ success: boolean; data: { agent: VoiceAgent } }>(`/api/voice/agents/${agentId}`);
    return response.data.agent;
  }

  /**
   * Start voice conversation
   */
  async startConversation(agentId: string, conversationId: string): Promise<{
    sessionId: string;
    conversationData: any;
    session: VoiceSession;
  }> {
    const response = await this.makeRequest<{
      success: boolean;
      data: {
        sessionId: string;
        conversationData: any;
        session: VoiceSession;
      };
    }>('/api/voice/conversations/start', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        conversationId,
        clientType: 'web',
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      })
    });

    return response.data;
  }

  /**
   * End voice conversation
   */
  async endConversation(sessionId: string): Promise<VoiceSession> {
    const response = await this.makeRequest<{ success: boolean; data: { session: VoiceSession } }>(
      `/api/voice/conversations/${sessionId}/end`,
      { method: 'POST' }
    );
    return response.data.session;
  }

  /**
   * Get conversation status
   */
  async getConversationStatus(sessionId: string): Promise<VoiceSession> {
    const response = await this.makeRequest<{ success: boolean; data: { session: VoiceSession } }>(
      `/api/voice/conversations/${sessionId}/status`
    );
    return response.data.session;
  }

  /**
   * Get user's voice usage statistics
   */
  async getVoiceUsage(): Promise<VoiceUsage> {
    const response = await this.makeRequest<{ success: boolean; data: { usage: VoiceUsage } }>('/api/voice/sessions/usage');
    return response.data.usage;
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<VoiceSession[]> {
    const response = await this.makeRequest<{ success: boolean; data: { sessions: VoiceSession[] } }>('/api/voice/sessions/active');
    return response.data.sessions;
  }

  /**
   * Start ElevenLabs conversation with DIRECT WebRTC connection
   * 
   * IMPORTANT: Voice Service provides token/config, but voice data flows
   * directly between client and ElevenLabs for optimal latency (<100ms)
   */
  async startElevenLabsConversation(agentId: string, conversationId: string): Promise<string> {
    try {
      console.log(`🎤 Starting DIRECT WebRTC conversation with agent: ${agentId}`);

      // 1. Get WebRTC token and config from Voice Service (CONTROL PLANE)
      const { sessionId, conversationData } = await this.startConversation(agentId, conversationId);
      
      console.log(`🔧 Voice Service setup complete. Token received for DIRECT connection.`);
      
      // 2. Import ElevenLabs SDK (assuming it's available globally or imported)
      // @ts-ignore
      const { Conversation } = await import('@elevenlabs/react');
      
      // 3. Establish DIRECT WebRTC connection to ElevenLabs (DATA PLANE)
      this.conversation = new Conversation();
      
      const elevenLabsSessionId = await this.conversation.startSession({
        conversationToken: conversationData.token,        // From Voice Service
        connectionType: 'webrtc',                         // DIRECT CONNECTION
        dynamicVariables: conversationData.dynamicVariables,
        
        onConnect: () => {
          console.log('🚀 DIRECT WebRTC connection established - optimal latency!');
          console.log('📊 Voice data now flows directly: Client ↔ ElevenLabs');
        },
        
        onDisconnect: () => {
          console.log('❌ Direct WebRTC connection closed');
          // Update session tracking in Voice Service
          this.endConversation(sessionId);
        },
        
        onMessage: (message: any) => {
          console.log('🔊 Real-time message received directly from ElevenLabs:', message);
          // Audio processed in real-time, no Voice Service involvement
        },
        
        onError: (error: string) => {
          console.error('❌ Direct WebRTC connection error:', error);
        }
      });

      console.log(`✅ Direct ElevenLabs WebRTC session: ${elevenLabsSessionId}`);
      console.log(`📈 Session tracking ID: ${sessionId}`);
      
      return sessionId;

    } catch (error) {
      console.error('❌ Failed to establish direct WebRTC connection:', error);
      throw error;
    }
  }

  /**
   * End ElevenLabs conversation
   */
  async endElevenLabsConversation(sessionId: string): Promise<void> {
    try {
      // End ElevenLabs session
      if (this.conversation) {
        await this.conversation.endSession();
        this.conversation = null;
      }

      // End session in Voice Service
      await this.endConversation(sessionId);
      
      console.log('✅ ElevenLabs conversation ended');
    } catch (error) {
      console.error('❌ Failed to end ElevenLabs conversation:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.makeRequest<{ success: boolean; data: { status: string; timestamp: string } }>('/api/voice/health');
    return response.data;
  }
}

// Usage Example
async function exampleUsage() {
  const client = new VoiceServiceClient(
    'http://localhost:3001',
    '1711|JPcIqtiocWWw0XUDu94YsyaoVw3n6ZST50n9rxtJ90e4e4f6'
  );

  try {
    // 1. Check service health
    const health = await client.healthCheck();
    console.log('Service health:', health);

    // 2. Get available agents
    const agents = await client.getAgents();
    console.log('Available agents:', agents);

    // 3. Check voice usage
    const usage = await client.getVoiceUsage();
    console.log('Voice usage:', usage);

    if (usage.isLimitReached) {
      console.log('❌ Voice limit reached for today');
      return;
    }

    // 4. Start conversation with first agent
    if (agents.length > 0) {
      const sessionId = await client.startElevenLabsConversation(
        agents[0].id,
        `conversation_${Date.now()}`
      );

      // 5. Let it run for a bit, then end
      setTimeout(async () => {
        await client.endElevenLabsConversation(sessionId);
        console.log('✅ Conversation ended');
      }, 30000); // 30 seconds
    }

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

export { VoiceServiceClient, exampleUsage };
