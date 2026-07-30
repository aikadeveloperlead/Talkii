import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isPrivateOrMetadataAddress } from "@/domain";
import type {
  WebhookDeliveryResult,
  WebhookSender,
  WebhookSendTarget,
} from "@/application/ports";

/**
 * HttpWebhookSender — SCR-011 §4.4 (Construir Payload → Firmar HMAC → HTTP
 * POST). Fuera de alcance (spec §1.3): retries, colas, rate limiting — un
 * único POST, sin reintentos, igual que WhatsAppMessageSender.
 *
 * SSRF: `Webhook.create` ya bloquea IPs/hostnames literalmente privados al
 * registrar la URL, pero un hostname "normal" puede resolver a una IP privada
 * en el momento del envío (DNS rebinding) — por eso se resuelve y valida de
 * nuevo aquí, justo antes de cada POST saliente.
 */
export interface HttpWebhookSenderOptions {
  /** Inyectable para tests; por defecto `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Inyectable para tests; por defecto `dns.promises.lookup`. */
  resolveHost?: (hostname: string) => Promise<Array<{ address: string }>>;
  /** Milisegundos antes de abortar el POST saliente. Por defecto 10s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpWebhookSender implements WebhookSender {
  private readonly fetchImpl: typeof fetch;
  private readonly resolveHost: (hostname: string) => Promise<Array<{ address: string }>>;
  private readonly timeoutMs: number;

  constructor(options: HttpWebhookSenderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.resolveHost = options.resolveHost ?? ((hostname) => lookup(hostname, { all: true }));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async send(
    target: WebhookSendTarget,
    eventName: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryResult> {
    const url = new URL(target.url);
    const addresses = await this.resolveHost(url.hostname);
    if (addresses.some((a) => isPrivateOrMetadataAddress(a.address))) {
      throw new Error(
        `HttpWebhookSender: ${url.hostname} resuelve a una red privada o al servicio de metadata — envío bloqueado (SSRF).`,
      );
    }

    const body = JSON.stringify({ event: eventName, data: payload });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (target.secret) {
      headers["X-Talkii-Signature-256"] =
        `sha256=${createHmac("sha256", target.secret).update(body, "utf8").digest("hex")}`;
    }

    const startedAt = Date.now();
    const response = await this.fetchImpl(target.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return { status: response.status, durationMs: Date.now() - startedAt };
  }
}
