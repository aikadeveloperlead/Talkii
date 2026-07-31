import { type FunnelStage, Identity, NotFoundError } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

/** AddFunnelStep — SCR-010 §6.2 POST /funnels/:id/steps. */
export class AddFunnelStep {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(funnelId: string, stage: FunnelStage): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new NotFoundError("AddFunnelStep: el Funnel no existe");
    }
    await this.funnels.save(funnel.withStages([...funnel.stages, stage]));
  }
}
