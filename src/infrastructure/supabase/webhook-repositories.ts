import type { SupabaseClient } from "@supabase/supabase-js";
import { Identity, Webhook, WebhookDelivery } from "@/domain";
import type { WebhookDeliveryRepository, WebhookRepository } from "@/application/ports";
import {
  deliveryToRow,
  rowToDelivery,
  rowToWebhook,
  webhookToRow,
  type WebhookDeliveryRow,
  type WebhookRow,
} from "./webhook-mappers";

import { throwIfUniqueViolation } from "./errors";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

/** Item BAJO #21 de la auditoría: columnas explícitas en vez de select("*"). */
const WEBHOOK_COLUMNS = "id,tenant_id,name,url,secret,events,status";
const WEBHOOK_DELIVERY_COLUMNS =
  "id,webhook_id,event_name,payload,status,response_status,response_time_ms,error_detail,occurred_at";

export class SupabaseWebhookRepository implements WebhookRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(webhook: Webhook): Promise<void> {
    const { error } = await this.db.from("webhooks").upsert(webhookToRow(webhook));
    throwIfUniqueViolation(error, "Webhook: ya existe un Webhook con ese nombre en el Tenant");
    if (error) fail("webhooks.upsert", error);
  }

  async findById(id: Identity): Promise<Webhook | null> {
    const { data, error } = await this.db
      .from("webhooks")
      .select(WEBHOOK_COLUMNS)
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("webhooks.select", error);
    return data ? rowToWebhook(data as WebhookRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Webhook[]> {
    const { data, error } = await this.db
      .from("webhooks")
      .select(WEBHOOK_COLUMNS)
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("webhooks.select", error);
    return (data as WebhookRow[]).map(rowToWebhook);
  }

  async findActiveByEvent(tenantId: Identity, eventName: string): Promise<Webhook[]> {
    const { data, error } = await this.db
      .from("webhooks")
      .select(WEBHOOK_COLUMNS)
      .eq("tenant_id", tenantId.toString())
      .eq("status", "active")
      .contains("events", [eventName]);
    if (error) fail("webhooks.select", error);
    return (data as WebhookRow[]).map(rowToWebhook);
  }
}

export class SupabaseWebhookDeliveryRepository implements WebhookDeliveryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(delivery: WebhookDelivery): Promise<void> {
    const { error } = await this.db.from("webhook_deliveries").insert(deliveryToRow(delivery));
    if (error) fail("webhook_deliveries.insert", error);
  }

  async listByWebhook(webhookId: Identity, limit?: number): Promise<WebhookDelivery[]> {
    // Ya venía ordenado desc (más reciente primero); lo que faltaba era la cota
    // — hallazgo HIGH de la auditoría santa-loop: sin `limit`, un webhook activo
    // hacía que una sola request trajera TODAS sus entregas históricas, cada una
    // con su `payload` jsonb completo.
    let query = this.db
      .from("webhook_deliveries")
      .select(WEBHOOK_DELIVERY_COLUMNS)
      .eq("webhook_id", webhookId.toString())
      .order("occurred_at", { ascending: false });
    if (limit !== undefined) query = query.limit(limit);

    const { data, error } = await query;
    if (error) fail("webhook_deliveries.select", error);
    return (data as WebhookDeliveryRow[]).map(rowToDelivery);
  }
}
