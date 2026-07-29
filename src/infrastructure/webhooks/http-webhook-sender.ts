import { createHmac } from "node:crypto";
import type { Webhook } from "@/domain";
import type { WebhookDeliveryResult, WebhookSender } from "@/application/ports";

/**
 * HttpWebhookSender — SCR-011 §4.4 (Construir Payload → Firmar HMAC → HTTP
 * POST). Fuera de alcance (spec §1.3): retries, colas, rate limiting — un
 * único POST, sin reintentos, igual que WhatsAppMessageSender.
 */
export class HttpWebhookSender implements WebhookSender {
  async send(
    webhook: Webhook,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify({ event: eventName, data: payload });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhook.secret) {
      headers["X-Talkii-Signature-256"] =
        `sha256=${createHmac("sha256", webhook.secret).update(body, "utf8").digest("hex")}`;
    }

    const startedAt = Date.now();
    const response = await fetch(webhook.url, { method: "POST", headers, body });
    return { status: response.status, durationMs: Date.now() - startedAt };
  }
}
