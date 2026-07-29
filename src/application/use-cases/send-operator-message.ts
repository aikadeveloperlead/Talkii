import { DomainError, Decision, Identity } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import type { ChannelBindingResolver } from "../ports/channel-binding";
import {
  ConversationRepository,
  DecisionRepository,
  SessionRepository,
} from "../ports/repositories";
import { IngestEvent } from "./ingest-event";
import { ExecuteDecision } from "./execute-decision";

/**
 * SendOperatorMessage — un operador humano compone y envía un mensaje
 * directamente (SCR-002 §7 POST /messages), fuera del ciclo del Reasoning
 * Provider.
 *
 * Respeta el modelo Event → Decision (SSOT §9: toda Decision deriva de
 * exactamente un Event): el acto de componer el mensaje se registra primero
 * como Event ("operator.message.composed"), y de él deriva la Decision con
 * source="human" (AA-02: el origen humano es un mecanismo de decisión más).
 * ExecuteDecision materializa el envío igual que para una decisión del
 * Reasoning Provider — mismo Event "message.sent" al final, misma proyección
 * en ListConversationMessages.
 */
export interface SendOperatorMessageInput {
  conversationId: string;
  text: string;
}

export interface SendOperatorMessageResult {
  decisionId: string;
}

export class SendOperatorMessage {
  constructor(
    private readonly ids: IdGenerator,
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
    private readonly bindings: ChannelBindingResolver,
    private readonly ingestEvent: IngestEvent,
    private readonly decisions: DecisionRepository,
    private readonly executeDecision: ExecuteDecision,
  ) {}

  async execute(input: SendOperatorMessageInput): Promise<SendOperatorMessageResult> {
    const conversation = await this.conversations.findById(
      Identity.of(input.conversationId),
    );
    if (!conversation) {
      throw new DomainError("SendOperatorMessage: la Conversation no existe");
    }

    const session = await this.sessions.findActiveByConversation(conversation.id);
    if (!session) {
      throw new DomainError("SendOperatorMessage: no hay Session activa");
    }

    const binding = await this.bindings.findByTenant(
      conversation.tenantId.toString(),
      conversation.channel,
    );
    if (!binding) {
      throw new DomainError(
        "SendOperatorMessage: no hay ChannelBinding configurado para el Tenant",
      );
    }

    const { eventId } = await this.ingestEvent.execute({
      sessionId: session.id.toString(),
      type: "operator.message.composed",
      payload: { text: input.text },
    });

    const decision = Decision.create(this.ids.next(), {
      sessionId: session.id,
      eventId: Identity.of(eventId),
      source: "human",
      rationale: "Mensaje compuesto manualmente por un operador",
      actions: [{ type: "message.send", params: { text: input.text } }],
    });
    await this.decisions.save(decision);

    await this.executeDecision.execute({
      decisionId: decision.id.toString(),
      binding,
      to: conversation.participants[0].channelHandle,
    });

    return { decisionId: decision.id.toString() };
  }
}
