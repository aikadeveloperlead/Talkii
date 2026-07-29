import { Identity } from "@/domain";
import { AgentRepository } from "../ports/repositories";

/** ListAgents — SCR-008 §6.1 GET /agents. */
export class ListAgents {
  constructor(private readonly agents: AgentRepository) {}

  async execute(tenantId: string) {
    const agents = await this.agents.listByTenant(Identity.of(tenantId));
    return agents.map((a) => ({
      id: a.id.toString(),
      name: a.name,
      role: a.role,
      status: a.status,
    }));
  }
}
