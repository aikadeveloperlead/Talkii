import { DomainError, Identity, NotFoundError } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

export interface UpdateFunnelInput {
  funnelId: string;
  name?: string;
  description?: string;
  adsAttribution?: boolean;
}

export class UpdateFunnel {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(input: UpdateFunnelInput): Promise<void> {
    const funnel = await this.funnels.findById(Identity.of(input.funnelId));
    if (!funnel) {
      throw new NotFoundError("UpdateFunnel: el Funnel no existe");
    }
    if (input.name && input.name !== funnel.name) {
      const existing = await this.funnels.findByName(funnel.tenantId, input.name);
      if (existing) {
        throw new DomainError("UpdateFunnel: ya existe un Funnel con ese nombre en el Tenant");
      }
    }

    const { funnelId: _omit, ...changes } = input;
    await this.funnels.save(funnel.withEdits(changes));
  }
}
