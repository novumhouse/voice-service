/**
 * Agent Configuration Manager
 * Manages the 4 ElevenLabs agents from environment variables
 */

export interface VoiceAgent {
  id: string;
  agentId: string;
  name: string;
  description: string;
  language: string;
  specialization: string;
  isActive: boolean;
}

class AgentConfigManager {
  private agents: Map<string, VoiceAgent> = new Map();

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    const agentConfigs = [
      {
        id: 'agent_1',
        agentId: process.env.AGENT_1_ID || 'agent_7401k56rrgbme4bvmb49ym9annev',
        name: 'Main Agent',
        description: 'Primary customer support agent',
        language: 'Polish',
        specialization: 'customer_support',
        isActive: true
      },
      {
        id: 'agent_2', 
        agentId: process.env.AGENT_2_ID || 'agent_0801k4z2a4cdfz2tms20kdyvav1a',
        name: 'Miły Agent',
        description: 'Specialized in dietary consultations',
        language: 'Polish',
        specialization: 'diet_consultation',
        isActive: true
      },
      {
        id: 'agent_3',
        agentId: process.env.AGENT_3_ID || 'agent_0801k4z2a4cdfz2tms20kdyvav1a',
        name: 'Inteligentny Agent',
        description: 'Sales and product recommendations',
        language: 'Polish', 
        specialization: 'sales',
        isActive: true
      },
      {
        id: 'agent_4',
        agentId: process.env.AGENT_4_ID || 'agent_0801k4z2a4cdfz2tms20kdyvav1a',
        name: 'Wesoły Agent',
        description: 'Technical support and troubleshooting',
        language: 'Polish',
        specialization: 'technical_support',
        isActive: true
      },

      {
        id: 'agent_5',
        agentId: process.env.AGENT_5_ID || 'agent_0801k4z2a4cdfz2tms20kdyvav1a',
        name: 'Slawkowy Agent',
        description: 'Testowy to do rozmowy',
        language: 'Polish',
        specialization: 'technical_support',
        isActive: true
      }
    ];

    agentConfigs.forEach(config => {
      this.agents.set(config.id, config);
    });

    console.log(`🤖 Initialized ${this.agents.size} voice agents`);
  }

  public getAgent(agentId: string): VoiceAgent | null {
    return this.agents.get(agentId) || null;
  }

  public getAllAgents(): VoiceAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.isActive);
  }

  public getAgentBySpecialization(specialization: string): VoiceAgent | null {
    return Array.from(this.agents.values())
      .find(agent => agent.specialization === specialization && agent.isActive) || null;
  }

  public validateAgentId(agentId: string): boolean {
    return this.agents.has(agentId) && this.agents.get(agentId)!.isActive;
  }
}

export const agentManager = new AgentConfigManager();
