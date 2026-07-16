import { Channel, Conversation, Identity, Participant, Session } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import {
  ConversationRepository,
  SessionRepository,
} from "../ports/repositories";

/**
 * StartConversation — abre una Conversation con su Session inicial.
 *
 * Materializa la invariante del SSOT Cap. 7 §6: «Toda Conversation contiene al
 * menos una Session». La regla de ciclo de vida se garantiza aquí, en el caso
 * de uso, no en el constructor de la entidad.
 */
export interface StartConversationInput {
  tenantId: string;
  channel: Channel;
  participant: Participant;
}

export interface StartConversationResult {
  conversationId: string;
  sessionId: string;
}

export class StartConversation {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(
    input: StartConversationInput,
  ): Promise<StartConversationResult> {
    const tenantId = Identity.of(input.tenantId);

    const conversation = Conversation.create(this.ids.next(), {
      tenantId,
      channel: input.channel,
      participants: [input.participant],
    });

    const session = Session.create(this.ids.next(), {
      conversationId: conversation.id,
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: this.clock.now(), kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });

    await this.conversations.save(conversation);
    await this.sessions.save(session);

    return {
      conversationId: conversation.id.toString(),
      sessionId: session.id.toString(),
    };
  }
}
