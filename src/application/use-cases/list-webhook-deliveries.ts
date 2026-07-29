import { Identity } from "@/domain";
import { WebhookDeliveryRepository } from "../ports/webhook-repositories";

/** ListWebhookDeliveries — SCR-011 §4.3 "Consultar Historial" (WH-06). */
export class ListWebhookDeliveries {
  constructor(private readonly deliveries: WebhookDeliveryRepository) {}

  async execute(webhookId: string) {
    const entries = await this.deliveries.listByWebhook(Identity.of(webhookId));
    return entries
      .map((d) => ({
        id: d.id.toString(),
        eventName: d.eventName,
        status: d.status,
        responseStatus: d.responseStatus,
        responseTimeMs: d.responseTimeMs,
        occurredAt: d.occurredAt,
      }))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
}
