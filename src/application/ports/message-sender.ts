import type { ChannelBinding } from "./channel-binding";

/**
 * Puerto: envío de mensajes salientes por un canal (AA-02 aplicado a la
 * ejecución — el proveedor concreto es un detalle de infraestructura).
 */
export interface OutboundMessage {
  readonly binding: ChannelBinding;
  /** Handle del destinatario en el canal (WhatsApp: wa_id). */
  readonly to: string;
  readonly text: string;
}

export interface MessageSendResult {
  /** Identidad del mensaje en el proveedor (WhatsApp: wamid saliente). */
  readonly externalMessageId: string;
}

export interface MessageSender {
  send(message: OutboundMessage): Promise<MessageSendResult>;
}
