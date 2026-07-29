import { Identity } from "@/domain";
import { AgentKnowledgeRepository } from "../ports/knowledge-repositories";

/** UnlinkAgentKnowledge — SCR-009 §6.5 DELETE /agents/:id/knowledge/:knowledgeId. */
export class UnlinkAgentKnowledge {
  constructor(private readonly agentKnowledge: AgentKnowledgeRepository) {}

  async execute(agentId: string, knowledgeId: string): Promise<void> {
    await this.agentKnowledge.unlink(Identity.of(agentId), Identity.of(knowledgeId));
  }
}
