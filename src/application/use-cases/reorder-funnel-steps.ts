import { Identity, NotFoundError } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

/** ReorderFunnelSteps — SCR-010 §6.2 PATCH /steps/reorder (BK-03: orden sin repetir). */
export class ReorderFunnelSteps {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(funnelId: string, orderedStepKeys: string[]): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) {
      throw new NotFoundError("ReorderFunnelSteps: el Funnel no existe");
    }

    const stages = funnel.stages.map((stage) => {
      const order = orderedStepKeys.indexOf(stage.stepKey ?? "");
      return order === -1 ? stage : { ...stage, order };
    });
    await this.funnels.save(funnel.withStages(stages));
  }
}
