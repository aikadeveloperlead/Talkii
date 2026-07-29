import { Channel, Identity, SessionStatus } from "@/domain";
import { ConversationRepository, SessionRepository } from "../ports/repositories";

/**
 * GetConversationDetail — proyección de lectura para el workspace de
 * Conversaciones (SCR-002 §7 GET /conversations/:id).
 *
 * No introduce persistencia nueva (AA-01): reconstruye la vista a partir de
 * Conversation + Session, ya existentes. Es la puerta de entrada del
 * Conversation Service descrito en el spec de implementación.
 */
export interface ConversationSessionDTO {
  id: string;
  status: SessionStatus;
  /** true si un operador humano desactivó el Runtime (SCR-002 Estado 8). */
  operatorControl: boolean;
}

export interface GetConversationDetailResult {
  conversationId: string;
  channel: Channel;
  participant: { channelHandle: string; displayName?: string };
  /** null si la Conversation no tiene ninguna Session activa. */
  session: ConversationSessionDTO | null;
}

export class GetConversationDetail {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(conversationId: string): Promise<GetConversationDetailResult | null> {
    const conversation = await this.conversations.findById(Identity.of(conversationId));
    if (!conversation) return null;

    const session = await this.sessions.findActiveByConversation(conversation.id);

    return {
      conversationId: conversation.id.toString(),
      channel: conversation.channel,
      participant: conversation.participants[0],
      session: session
        ? {
            id: session.id.toString(),
            status: session.state.status,
            operatorControl: session.dimensions.metadata.operatorControl === true,
          }
        : null,
    };
  }
}
