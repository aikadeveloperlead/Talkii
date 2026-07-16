import type {
  MessageSender,
  MessageSendResult,
  OutboundMessage,
} from "@/application/ports";

/**
 * Adapter concreto del puerto MessageSender sobre la WhatsApp Cloud API
 * (Graph API de Meta), con fetch nativo — sin dependencias nuevas.
 *
 * Credenciales: prioridad `binding.accessToken` (BYO-número por tenant) →
 * `options.accessToken` → env `WHATSAPP_ACCESS_TOKEN` (token de plataforma).
 */
export interface WhatsAppSenderOptions {
  accessToken?: string;
  graphVersion?: string;
  /** Inyectable en tests; por defecto el fetch global de Node. */
  fetchFn?: typeof fetch;
}

interface GraphSendResponse {
  messages?: Array<{ id?: string }>;
}

export class WhatsAppMessageSender implements MessageSender {
  constructor(private readonly options: WhatsAppSenderOptions = {}) {}

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    const token =
      message.binding.accessToken ??
      this.options.accessToken ??
      process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "WhatsApp: falta el access token (binding.accessToken o WHATSAPP_ACCESS_TOKEN).",
      );
    }

    const version =
      this.options.graphVersion ?? process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
    const fetchFn = this.options.fetchFn ?? fetch;

    const response = await fetchFn(
      `https://graph.facebook.com/${version}/${message.binding.externalId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: "text",
          text: { body: message.text },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`WhatsApp send: HTTP ${response.status} — ${detail}`);
    }

    const json = (await response.json()) as GraphSendResponse;
    return { externalMessageId: json.messages?.[0]?.id ?? "" };
  }
}
