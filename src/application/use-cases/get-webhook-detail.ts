import { Identity } from "@/domain";
import { WebhookRepository } from "../ports/webhook-repositories";

export class GetWebhookDetail {
  constructor(private readonly webhooks: WebhookRepository) {}

  async execute(webhookId: string) {
    const webhook = await this.webhooks.findById(Identity.of(webhookId));
    if (!webhook) return null;
    return {
      id: webhook.id.toString(),
      name: webhook.name,
      url: webhook.url,
      events: [...webhook.events],
      status: webhook.status,
    };
  }
}
