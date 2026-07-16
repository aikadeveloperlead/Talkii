/**
 * Parseo del payload de webhooks de la WhatsApp Cloud API (Meta).
 *
 * Funciones puras y defensivas: Meta puede enviar mensajes, statuses de
 * entrega y otros cambios en el mismo POST; aquí solo se extraen los mensajes
 * de TEXTO (alcance de esta fase). Un payload malformado produce lista vacía,
 * nunca una excepción (el webhook siempre debe responder 200).
 */
export interface ParsedInboundMessage {
  /** phone_number_id del número receptor (clave del ChannelBinding). */
  phoneNumberId: string;
  /** Identidad del mensaje en Meta (idempotencia). */
  wamid: string;
  /** wa_id del remitente. */
  from: string;
  displayName?: string;
  text: string;
  timestamp: Date;
}

interface MetaContact {
  wa_id?: string;
  profile?: { name?: string };
}

interface MetaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

interface MetaChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
}

export function parseWebhookPayload(payload: unknown): ParsedInboundMessage[] {
  const result: ParsedInboundMessage[] = [];
  if (typeof payload !== "object" || payload === null) return result;

  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return result;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: MetaChangeValue })?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages;
      if (!phoneNumberId || !Array.isArray(messages)) continue;

      for (const message of messages) {
        if (message?.type !== "text") continue;
        const wamid = message.id;
        const from = message.from;
        const text = message.text?.body;
        if (!wamid || !from || typeof text !== "string") continue;

        const contact = value?.contacts?.find((c) => c.wa_id === from);
        const seconds = Number(message.timestamp);
        result.push({
          phoneNumberId,
          wamid,
          from,
          displayName: contact?.profile?.name,
          text,
          timestamp: Number.isFinite(seconds)
            ? new Date(seconds * 1000)
            : new Date(),
        });
      }
    }
  }

  return result;
}
