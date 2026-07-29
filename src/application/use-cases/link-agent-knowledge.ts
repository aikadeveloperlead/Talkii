import { DomainError, Identity } from "@/domain";
import { AgentRepository } from "../ports/repositories";
import { AgentKnowledgeRepository, KnowledgeRepository } from "../ports/knowledge-repositories";

/** LinkAgentKnowledge — SCR-009 §6.5 POST /agents/:id/knowledge (BK-05: N:N). */
export class LinkAgentKnowledge {
  constructor(
    private readonly agents: AgentRepository,
    private readonly knowledge: KnowledgeRepository,
    private readonly agentKnowledge: AgentKnowledgeRepository,
  ) {}

  async execute(agentId: string, knowledgeId: string): Promise<void> {
    const agentIdentity = Identity.of(agentId);
    const knowledgeIdentity = Identity.of(knowledgeId);

    if (!(await this.agents.findById(agentIdentity))) {
      throw new DomainError("LinkAgentKnowledge: el Agent no existe");
    }
    if (!(await this.knowledge.findById(knowledgeIdentity))) {
      throw new DomainError("LinkAgentKnowledge: el documento no existe");
    }

    await this.agentKnowledge.link(agentIdentity, knowledgeIdentity);
  }
}
