import { Identity } from "@/domain";
import { FunnelRepository } from "../ports/repositories";

export class GetFunnelDetail {
  constructor(private readonly funnels: FunnelRepository) {}

  async execute(funnelId: string) {
    const funnel = await this.funnels.findById(Identity.of(funnelId));
    if (!funnel) return null;
    return {
      id: funnel.id.toString(),
      name: funnel.name,
      description: funnel.description,
      status: funnel.status,
      adsAttribution: funnel.adsAttribution,
      stages: [...funnel.stages],
    };
  }
}
