import { type AgentStatus, Identity, NotFoundError } from "@/domain";
import { AgentRepository } from "../ports/repositories";

/** SetAgentStatus — SCR-008 §6.1 PATCH /agents/:id/status y DELETE /agents/:id (archivar = status "archived", nunca elimina físicamente — BK-04). */
export class SetAgentStatus {
  constructor(private readonly agents: AgentRepository) {}

  async execute(agentId: string, status: AgentStatus): Promise<void> {
    const agent = await this.agents.findById(Identity.of(agentId));
    if (!agent) {
      throw new NotFoundError("SetAgentStatus: el Agent no existe");
    }
    await this.agents.save(agent.withStatus(status));
  }
}
