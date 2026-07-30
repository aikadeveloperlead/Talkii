/**
 * Puerto: envío de mensajes salientes por un canal (AA-02 aplicado a la
 * ejecución — el proveedor concreto es un detalle de infraestructura).
 *
 * `OutboundChannelTarget` es deliberadamente más angosto que la entidad
 * `ChannelBinding` completa (item MEDIO #5 de la auditoría: "secretos viajan
 * por DTOs completos" — antes este puerto recibía el `ChannelBinding` entero,
 * incluido `accessToken`, cuando el adaptador solo necesita 2 campos para
 * autenticar y direccionar el envío). Una `ChannelBinding` real satisface esta
 * forma estructuralmente, así que los callers no cambian.
 */
export interface OutboundChannelTarget {
  readonly externalId: string;
  readonly accessToken?: string;
}

export interface OutboundMessage {
  readonly binding: OutboundChannelTarget;
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
