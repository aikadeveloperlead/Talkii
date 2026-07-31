import { Identity } from "@/domain";
import { WebhookDeliveryRepository } from "../ports/webhook-repositories";

const DEFAULT_LIMIT = 50;
export const MAX_DELIVERY_LIMIT = 200;

/** ListWebhookDeliveries — SCR-011 §4.3 "Consultar Historial" (WH-06). */
export class ListWebhookDeliveries {
  constructor(private readonly deliveries: WebhookDeliveryRepository) {}

  /**
   * `limit` acota a las entregas más recientes — hallazgo HIGH de la auditoría
   * santa-loop: sin cota, este endpoint devolvía TODAS las entregas históricas
   * del webhook (tabla append-only sin retención), cada una con su payload.
   */
  async execute(webhookId: string, limit = DEFAULT_LIMIT) {
    const capped = Math.min(Math.max(limit, 1), MAX_DELIVERY_LIMIT);
    const entries = await this.deliveries.listByWebhook(Identity.of(webhookId), capped);
    return entries
      .map((d) => ({
        id: d.id.toString(),
        eventName: d.eventName,
        status: d.status,
        responseStatus: d.responseStatus,
        responseTimeMs: d.responseTimeMs,
        errorDetail: d.errorDetail,
        occurredAt: d.occurredAt,
      }))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
}
