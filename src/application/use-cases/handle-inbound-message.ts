import { Channel, Identity, Session } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import type { ChannelBindingResolver } from "../ports/channel-binding";
import {
  ConversationRepository,
  DuplicateExternalEventError,
  SessionRepository,
} from "../ports/repositories";
import { StartConversation } from "./start-conversation";
import { IngestEvent } from "./ingest-event";
import { MakeDecision } from "./make-decision";
import { ExecuteDecision } from "./execute-decision";

/**
 * HandleInboundMessage — orquestador del ciclo completo para un mensaje
 * entrante de un canal externo (SSOT Cap. 6: Event → Context → Decision →
 * Action Plan → Actions).
 *
 * Resuelve qué Tenant/Agent atiende el número receptor (ChannelBinding),
 * localiza o abre la Conversation/Session del participante, registra el hecho
 * (IngestEvent), decide (MakeDecision) y materializa el plan (ExecuteDecision).
 *
 * Idempotencia: si el hecho ya fue ingerido (mismo externalId — reintento del
 * webhook), corta con status "duplicate" sin decidir ni reenviar.
 */
export interface InboundMessageInput {
  channel: Channel;
  /** Identidad del canal receptor en el proveedor (phone_number_id). */
  channelExternalId: string;
  /** Identidad del mensaje en el proveedor (wamid). */
  externalMessageId: string;
  /** Handle del remitente (wa_id del cliente). */
  from: string;
  displayName?: string;
  text: string;
  timestamp: Date;
}

export type HandleInboundMessageResult =
  | { status: "processed"; decisionId: string }
  | { status: "duplicate" }
  | { status: "unbound" };

export class HandleInboundMessage {
  constructor(
    private readonly bindings: ChannelBindingResolver,
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly startConversation: StartConversation,
    private readonly ingestEvent: IngestEvent,
    private readonly makeDecision: MakeDecision,
    private readonly executeDecision: ExecuteDecision,
  ) {}

  async execute(
    input: InboundMessageInput,
  ): Promise<HandleInboundMessageResult> {
    const binding = await this.bindings.findByChannelIdentity(
      input.channel,
      input.channelExternalId,
    );
    if (!binding) return { status: "unbound" };

    const sessionId = await this.resolveActiveSession(binding.tenantId, input);

    let eventId: string;
    try {
      const ingested = await this.ingestEvent.execute({
        sessionId,
        type: "message.received",
        externalId: input.externalMessageId,
        payload: {
          wamid: input.externalMessageId,
          from: input.from,
          text: input.text,
          timestamp: input.timestamp.toISOString(),
        },
      });
      eventId = ingested.eventId;
    } catch (error) {
      if (error instanceof DuplicateExternalEventError) {
        return { status: "duplicate" };
      }
      throw error;
    }

    const { decisionId } = await this.makeDecision.execute({
      eventId,
      agentId: binding.agentId,
      funnelId: binding.funnelId,
    });

    await this.executeDecision.execute({
      decisionId,
      binding,
      to: input.from,
    });

    return { status: "processed", decisionId };
  }

  /** Conversation existente (o nueva) del participante, con Session activa. */
  private async resolveActiveSession(
    tenantId: string,
    input: InboundMessageInput,
  ): Promise<string> {
    const conversation = await this.conversations.findByParticipant(
      Identity.of(tenantId),
      input.channel,
      input.from,
    );

    if (!conversation) {
      const started = await this.startConversation.execute({
        tenantId,
        channel: input.channel,
        participant: {
          channelHandle: input.from,
          displayName: input.displayName,
        },
      });
      return started.sessionId;
    }

    const active = await this.sessions.findActiveByConversation(conversation.id);
    if (active) return active.id.toString();

    // La relación existe pero todas sus Sessions están cerradas: se abre una
    // nueva unidad operativa sobre la misma Conversation (SSOT Cap. 7 §6: el
    // cierre de una Session no cierra la Conversation).
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
    await this.sessions.save(session);
    return session.id.toString();
  }
}
