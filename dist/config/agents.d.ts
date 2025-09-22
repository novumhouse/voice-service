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
declare class AgentConfigManager {
    private agents;
    constructor();
    private initializeAgents;
    getAgent(agentId: string): VoiceAgent | null;
    getAllAgents(): VoiceAgent[];
    getAgentBySpecialization(specialization: string): VoiceAgent | null;
    validateAgentId(agentId: string): boolean;
}
export declare const agentManager: AgentConfigManager;
export {};
//# sourceMappingURL=agents.d.ts.map