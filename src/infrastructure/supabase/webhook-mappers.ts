import {
  Identity,
  Webhook,
  WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookStatus,
} from "@/domain";

export interface WebhookRow {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  status: WebhookStatus;
}
export function webhookToRow(webhook: Webhook): WebhookRow {
  return {
    id: webhook.id.toString(),
    tenant_id: webhook.tenantId.toString(),
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret ?? null,
    events: [...webhook.events],
    status: webhook.status,
  };
}
export function rowToWebhook(row: WebhookRow): Webhook {
  return Webhook.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    url: row.url,
    secret: row.secret ?? undefined,
    events: row.events ?? [],
    status: row.status,
  });
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  response_status: number | null;
  response_time_ms: number | null;
  occurred_at: string;
}
export function deliveryToRow(delivery: WebhookDelivery): WebhookDeliveryRow {
  return {
    id: delivery.id.toString(),
    webhook_id: delivery.webhookId.toString(),
    event_name: delivery.eventName,
    payload: { ...delivery.payload },
    status: delivery.status,
    response_status: delivery.responseStatus ?? null,
    response_time_ms: delivery.responseTimeMs ?? null,
    occurred_at: delivery.occurredAt.toISOString(),
  };
}
export function rowToDelivery(row: WebhookDeliveryRow): WebhookDelivery {
  return WebhookDelivery.create(Identity.of(row.id), {
    webhookId: Identity.of(row.webhook_id),
    eventName: row.event_name,
    payload: row.payload ?? {},
    status: row.status,
    responseStatus: row.response_status ?? undefined,
    responseTimeMs: row.response_time_ms ?? undefined,
    occurredAt: new Date(row.occurred_at),
  });
}
