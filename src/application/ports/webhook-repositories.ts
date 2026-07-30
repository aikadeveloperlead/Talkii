import { Identity, Webhook, WebhookDelivery } from "@/domain";

/**
 * Item MEDIO #5 de la auditoría: antes `WebhookSender.send` recibía el
 * `Webhook` completo (incluido `secret`, un credential propio del Tenant)
 * cuando el adaptador HTTP solo necesita `url`/`secret` para firmar y
 * direccionar el envío. Un `Webhook` real satisface esta forma
 * estructuralmente, así que los callers existentes no cambian.
 */
export interface WebhookSendTarget {
  readonly url: string;
  readonly secret?: string;
}

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
  send(
    target: WebhookSendTarget,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryResult>;
}
