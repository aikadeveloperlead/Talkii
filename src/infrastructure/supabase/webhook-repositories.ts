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

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

export class SupabaseWebhookRepository implements WebhookRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(webhook: Webhook): Promise<void> {
    const { error } = await this.db.from("webhooks").upsert(webhookToRow(webhook));
    if (error) fail("webhooks.upsert", error);
  }

  async findById(id: Identity): Promise<Webhook | null> {
    const { data, error } = await this.db
      .from("webhooks")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("webhooks.select", error);
    return data ? rowToWebhook(data as WebhookRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Webhook[]> {
    const { data, error } = await this.db
      .from("webhooks")
      .select("*")
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("webhooks.select", error);
    return (data as WebhookRow[]).map(rowToWebhook);
  }

  async findActiveByEvent(tenantId: Identity, eventName: string): Promise<Webhook[]> {
    const { data, error } = await this.db
      .from("webhooks")
      .select("*")
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

  async listByWebhook(webhookId: Identity): Promise<WebhookDelivery[]> {
    const { data, error } = await this.db
      .from("webhook_deliveries")
      .select("*")
      .eq("webhook_id", webhookId.toString())
      .order("occurred_at", { ascending: false });
    if (error) fail("webhook_deliveries.select", error);
    return (data as WebhookDeliveryRow[]).map(rowToDelivery);
  }
}
