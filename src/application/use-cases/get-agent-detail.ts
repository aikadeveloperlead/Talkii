import { Identity } from "@/domain";
import { AgentRepository } from "../ports/repositories";

/** GetAgentDetail — SCR-008 §6.1 GET /agents/:id. */
export class GetAgentDetail {
  constructor(private readonly agents: AgentRepository) {}

  async execute(agentId: string) {
    const agent = await this.agents.findById(Identity.of(agentId));
    if (!agent) return null;
    return {
      id: agent.id.toString(),
      name: agent.name,
      role: agent.role,
      objective: agent.objective,
      permanentPrompt: agent.permanentPrompt,
      status: agent.status,
      personality: agent.personality,
      language: agent.language,
      tone: agent.tone,
      businessName: agent.businessName,
      businessDescription: agent.businessDescription,
      productsServices: agent.productsServices,
      businessType: agent.businessType,
      welcomeMessage: agent.welcomeMessage,
      fallbackMessage: agent.fallbackMessage,
      transferKeywords: [...agent.transferKeywords],
      captureFields: [...agent.captureFields],
    };
  }
}
