import { DomainError, Identity, type FunnelStatus } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

/** SetFunnelStatus — SCR-010 §6.1 DELETE /funnels/:id archiva (status="archived"). */
export class SetFunnelStatus {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(funnelId: string, status: FunnelStatus): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new DomainError("SetFunnelStatus: el Funnel no existe");
    }
    await this.funnels.save(funnel.withStatus(status));
  }
}
