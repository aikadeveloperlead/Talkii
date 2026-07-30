import { Identity, WebhookDelivery } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import {
  WebhookDeliveryRepository,
  WebhookRepository,
  WebhookSender,
} from "../ports/webhook-repositories";

/**
 * DispatchWebhookEvent — SCR-011 §4.4 (Validar Webhooks Activos → Construir
 * Payload → Firmar → HTTP POST → Registrar Resultado). BK-05: toda entrega
 * queda registrada, incluso si falla.
 *
 * Deliberadamente NO se invoca todavía desde los demás casos de uso
 * (HandleInboundMessage, CreateCustomer, CreateAppointment, ...) — cablear el
 * disparo automático por cada evento de dominio es una pasada de integración
 * cross-módulo aparte (mismo criterio que el resto de integraciones diferidas
 * esta sesión). Este caso de uso deja lista la capacidad de publicar.
 */
export class DispatchWebhookEvent {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly webhooks: WebhookRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly sender: WebhookSender,
  ) {}

  async execute(
    tenantId: string,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<{ dispatched: number }> {
    const subscribed = await this.webhooks.findActiveByEvent(Identity.of(tenantId), eventName);

    let dispatched = 0;
    for (const webhook of subscribed) {
      try {
        const result = await this.sender.send(webhook, eventName, payload);
        await this.deliveries.save(
          WebhookDelivery.create(this.ids.next(), {
            webhookId: webhook.id,
            eventName,
            payload,
            status: result.status >= 200 && result.status < 300 ? "delivered" : "failed",
            responseStatus: result.status,
            responseTimeMs: result.durationMs,
            occurredAt: this.clock.now(),
          }),
        );
        dispatched += 1;
      } catch (error) {
        await this.deliveries.save(
          WebhookDelivery.create(this.ids.next(), {
            webhookId: webhook.id,
            eventName,
            payload,
            status: "failed",
            errorDetail: error instanceof Error ? error.message : String(error),
            occurredAt: this.clock.now(),
          }),
        );
      }
    }
    return { dispatched };
  }
}
