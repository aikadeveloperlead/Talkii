import { Identity, NotFoundError } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

/** DeleteFunnelStep — SCR-010 §6.2 DELETE /steps/:id (BK-02: el Funnel debe conservar al menos un paso). */
export class DeleteFunnelStep {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(funnelId: string, stepKey: string): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new NotFoundError("DeleteFunnelStep: el Funnel no existe");
    }
    const remaining = funnel.stages.filter((s) => s.stepKey !== stepKey);
    await this.funnels.save(funnel.withStages(remaining));
  }
}
