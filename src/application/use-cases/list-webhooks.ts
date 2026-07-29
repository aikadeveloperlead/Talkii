import { Identity } from "@/domain";
import { WebhookRepository } from "../ports/webhook-repositories";

export class ListWebhooks {
  constructor(private readonly webhooks: WebhookRepository) {}

  async execute(tenantId: string) {
    const webhooks = await this.webhooks.listByTenant(Identity.of(tenantId));
    return webhooks.map((w) => ({
      id: w.id.toString(),
      name: w.name,
      url: w.url,
      events: [...w.events],
      status: w.status,
    }));
  }
}
