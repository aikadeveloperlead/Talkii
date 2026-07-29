import { DomainError, Funnel, Identity, type FunnelStage } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { FunnelRepository } from "../ports/repositories";

/** CreateFunnel — SCR-010 §6.1 (BK-01: nombre único por Tenant; BK-02: al menos un paso, ya enforced por la entidad). */
export interface CreateFunnelInput {
  tenantId: string;
  name: string;
  description?: string;
  stages: FunnelStage[];
}

export class CreateFunnel {
  constructor(
    private readonly ids: IdGenerator,
    private readonly funnels: FunnelRepository,
  ) {}

  async execute(input: CreateFunnelInput): Promise<{ funnelId: string }> {
    const tenantId = Identity.of(input.tenantId);

    const existing = await this.funnels.findByName(tenantId, input.name);
    if (existing) {
      throw new DomainError("CreateFunnel: ya existe un Funnel con ese nombre en el Tenant");
    }

    const funnel = Funnel.create(this.ids.next(), {
      tenantId,
      name: input.name,
      description: input.description,
      stages: input.stages,
      status: "draft",
    });
    await this.funnels.save(funnel);

    return { funnelId: funnel.id.toString() };
  }
}
