import { Identity, Webhook, WebhookDelivery } from "@/domain";

export interface WebhookRepository {
  save(webhook: Webhook): Promise<void>;
  findById(id: Identity): Promise<Webhook | null>;
  listByTenant(tenantId: Identity): Promise<Webhook[]>;
  /** Webhooks activos del Tenant suscritos a un evento (BK-04: solo entrega a los activos). */
  findActiveByEvent(tenantId: Identity, eventName: string): Promise<Webhook[]>;
}

export interface WebhookDeliveryRepository {
  save(delivery: WebhookDelivery): Promise<void>;
  listByWebhook(webhookId: Identity): Promise<WebhookDelivery[]>;
}

export interface WebhookDeliveryResult {
  status: number;
  durationMs: number;
}

/** Puerto de envío HTTP saliente (SCR-011 §4.4: Construir Payload → Firmar → POST). */
export interface WebhookSender {
  send(webhook: Webhook, eventName: string, payload: Record<string, unknown>): Promise<WebhookDeliveryResult>;
}
