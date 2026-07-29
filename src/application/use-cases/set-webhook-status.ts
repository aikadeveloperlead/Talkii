import { DomainError, Identity, type WebhookStatus } from "@/domain";
import { WebhookRepository } from "../ports/webhook-repositories";

/** SetWebhookStatus — SCR-011 §4.3 activar/desactivar/archivar (WH-04: sin eliminarse). */
export class SetWebhookStatus {
  constructor(private readonly webhooks: WebhookRepository) {}

  async execute(webhookId: string, status: WebhookStatus): Promise<void> {
    const webhook = await this.webhooks.findById(Identity.of(webhookId));
    if (!webhook) {
      throw new DomainError("SetWebhookStatus: el Webhook no existe");
    }
    await this.webhooks.save(webhook.withStatus(status));
  }
}
