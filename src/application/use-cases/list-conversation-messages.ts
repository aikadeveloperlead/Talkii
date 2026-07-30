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

export class ListConversationMessages {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
    private readonly events: EventRepository,
  ) {}

  async execute(conversationId: string): Promise<ConversationMessageDTO[] | null> {
    const conversation = await this.conversations.findById(Identity.of(conversationId));
    if (!conversation) return null;

    const sessions = await this.sessions.findAllByConversation(conversation.id);

    const events = await this.events.findBySessions(sessions.map((s) => s.id));
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
