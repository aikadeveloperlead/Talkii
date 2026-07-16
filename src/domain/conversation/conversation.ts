import { Entity, Identity, invariant } from "../shared";

/**
 * Canal por el que discurre una Conversation. En esta fase el dominio reconoce
 * WhatsApp; el canal es un concepto del dominio, no un detalle de proveedor.
 */
export type Channel = "whatsapp";

/**
 * Participant — Objeto de Valor: un participante de la relación (típicamente el
 * cliente), identificado por su handle en el canal.
 */
export interface Participant {
  readonly channelHandle: string;
  readonly displayName?: string;
}

/**
 * Conversation — Entidad Relacional (SSOT Cap. 7 §6).
 *
 * Representa la relación persistente entre un cliente y la organización a través
 * de uno o varios canales. Es la continuidad del vínculo — NO el historial de
 * mensajes ni la interfaz.
 *
 * Invariantes (SSOT §6): pertenece a exactamente un Tenant; contiene al menos
 * una Session; su identidad permanece estable toda su existencia; el cierre de
 * una Session no cierra la Conversation.
 *
 * Nota de modelado: la invariante «contiene al menos una Session» es una regla
 * de ciclo de vida del agregado — se garantiza en el caso de uso que abre la
 * Conversation (creando su Session inicial), no en el constructor de esta
 * entidad, que solo conserva la identidad de la relación.
 */
export interface ConversationProps {
  tenantId: Identity;
  channel: Channel;
  participants: Participant[];
}

export class Conversation extends Entity {
  private constructor(
    id: Identity,
    private readonly props: ConversationProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: ConversationProps): Conversation {
    invariant(
      props.participants.length > 0,
      "Conversation: debe tener al menos un participante",
    );
    return new Conversation(id, {
      ...props,
      participants: [...props.participants],
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }

  get channel(): Channel {
    return this.props.channel;
  }

  get participants(): readonly Participant[] {
    return this.props.participants;
  }
}
