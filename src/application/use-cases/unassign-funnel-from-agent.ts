import { DomainError, Identity } from "@/domain";
import { AgentRepository } from "../ports/repositories";

/** UnassignFunnelFromAgent — SCR-010 §6.4 DELETE /agents/:id/funnel. */
export class UnassignFunnelFromAgent {
  constructor(private readonly agents: AgentRepository) {}

  async execute(agentId: string): Promise<void> {
    const agent = await this.agents.findById(Identity.of(agentId));
    if (!agent) {
      throw new DomainError("UnassignFunnelFromAgent: el Agent no existe");
    }
    await this.agents.save(agent.withFunnel(undefined));
  }
}
