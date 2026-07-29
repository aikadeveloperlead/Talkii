import { Identity } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

export class ListFunnels {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(tenantId: string) {
    const funnels = await this.funnels.listByTenant(Identity.of(tenantId));
    return funnels.map((f) => ({
      id: f.id.toString(),
      name: f.name,
      status: f.status,
      stepCount: f.stages.length,
    }));
  }
}
