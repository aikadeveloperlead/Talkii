import { Identity } from "@/domain";
import {
  ConversationRepository,
  EventRepository,
  SessionRepository,
} from "../ports/repositories";

/**
 * ListConversationMessages — proyección de lectura (SCR-002 §7
 * GET /conversations/:id/messages).
 *
 * Los mensajes NO son una entidad persistida: se reconstruyen a partir de los
 * Events "message.received"/"message.sent" ya registrados por
 * HandleInboundMessage/ExecuteDecision (AA-01 — evita una tabla `message`
 * paralela al log de Events que ya es la fuente de verdad). Recorre todas las
 * Sessions de la Conversation (una relación puede reabrir Sessions).
 */
export interface ConversationMessageDTO {
  id: string;
  sender: "customer" | "agent";
  text: string;
  at: Date;
}

const MESSAGE_EVENT_TYPES: Record<string, "customer" | "agent"> = {
  "message.received": "customer",
  "message.sent": "agent",
};

const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 200;
/** No todo Event es un turno de mensaje: se sobre-pide para no quedarse corto. */
const MESSAGE_OVERFETCH = 3;

export class ListConversationMessages {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
    private readonly events: EventRepository,
  ) {}

  /**
   * `limit` acota al bloque de mensajes MÁS RECIENTE. Antes se devolvía el
   * historial completo de la Conversation (hallazgo HIGH de la auditoría
   * santa-loop: `events` es append-only sin retención, así que una relación
   * larga hacía que una sola request serializara todo su historial).
   */
  async execute(
    conversationId: string,
    limit = DEFAULT_MESSAGE_LIMIT,
  ): Promise<ConversationMessageDTO[] | null> {
    const conversation = await this.conversations.findById(Identity.of(conversationId));
    if (!conversation) return null;

    const capped = Math.min(Math.max(limit, 1), MAX_MESSAGE_LIMIT);

    const sessions = await this.sessions.findAllByConversation(conversation.id);

    // Se sobre-pide porque no todo Event es un turno de mensaje (se filtran
    // abajo por MESSAGE_EVENT_TYPES), pero sigue acotado.
    const events = await this.events.findBySessions(
      sessions.map((s) => s.id),
      capped * MESSAGE_OVERFETCH,
    );
    const messages: ConversationMessageDTO[] = [];
    for (const event of events) {
      const sender = MESSAGE_EVENT_TYPES[event.type];
      if (!sender) continue;
      messages.push({
        id: event.id.toString(),
        sender,
        text: typeof event.payload.text === "string" ? event.payload.text : "",
        at: event.occurredAt,
      });
    }

    messages.sort((a, b) => a.at.getTime() - b.at.getTime());
    return messages;
  }
}
