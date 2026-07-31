import { Identity, NotFoundError } from "@/domain";
import { AgentRepository, FunnelRepository } from "../ports/repositories";

/** AssignFunnelToAgent — SCR-010 §6.4 POST /agents/:id/funnel (FN-02: el Agent solo referencia un Funnel). */
export class AssignFunnelToAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly funnels: FunnelRepository,
  ) {}

  async execute(agentId: string, funnelId: string): Promise<void> {
    const agent = await this.agents.findById(Identity.of(agentId));
    if (!agent) {
      throw new NotFoundError("AssignFunnelToAgent: el Agent no existe");
    }
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new NotFoundError("AssignFunnelToAgent: el Funnel no existe");
    }
    await this.agents.save(agent.withFunnel(funnel.id));
  }
}
