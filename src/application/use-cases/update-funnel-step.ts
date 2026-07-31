import { type FunnelStage, Identity, NotFoundError } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

/** UpdateFunnelStep — SCR-010 §6.2 PUT /steps/:id (identificado por stepKey dentro del Funnel). */
export class UpdateFunnelStep {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(
    funnelId: string,
    stepKey: string,
    changes: Partial<FunnelStage>,
  ): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new NotFoundError("UpdateFunnelStep: el Funnel no existe");
    }
    const index = funnel.stages.findIndex((s) => s.stepKey === stepKey);
    if (index === -1) {
      throw new NotFoundError("UpdateFunnelStep: el paso no existe en el Funnel");
    }

    const stages = [...funnel.stages];
    stages[index] = { ...stages[index], ...changes };
    await this.funnels.save(funnel.withStages(stages));
  }
}
