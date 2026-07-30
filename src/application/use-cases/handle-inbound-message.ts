import { Channel, DomainError, Identity, Session } from "@/domain";
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
  | { status: "unbound" }
  | { status: "human-controlled" };

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
    /** Cierra la Session activa si su última actividad supera este umbral (item MEDIO de auditoría: SessionStatus="closed" nunca se producía). */
    private readonly inactivityTimeoutMs: number,
  ) {}

  async execute(
    input: InboundMessageInput,
  ): Promise<HandleInboundMessageResult> {
    const binding = await this.bindings.findByChannelIdentity(
      input.channel,
      input.channelExternalId,
    );
    if (!binding) return { status: "unbound" };

    const sessionId = await this.resolveActiveSession(binding.tenantId.toString(), input);

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

    // Un operador con control activo desactiva el Runtime (SCR-002 Estado 8):
    // el hecho queda registrado (el operador lo ve en el workspace) pero el
    // Decision Engine no decide ni responde automáticamente.
    const session = await this.sessions.findById(Identity.of(sessionId));
    if (session?.operatorControl === true) {
      return { status: "human-controlled" };
    }

    const { decisionId } = await this.makeDecision.execute({
      eventId,
      agentId: binding.agentId.toString(),
      funnelId: binding.funnelId?.toString(),
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
    if (active) {
      const lastActivity = active.lastActivityAt;
      const isStale =
        lastActivity !== undefined &&
        this.clock.now().getTime() - lastActivity.getTime() > this.inactivityTimeoutMs;
      if (!isStale) return active.id.toString();
      await this.sessions.save(active.close(this.clock.now()));
    }

    // La relación existe pero todas sus Sessions están cerradas (o la activa
    // quedó stale y se acaba de cerrar): se abre una
    // nueva unidad operativa sobre la misma Conversation (SSOT Cap. 7 §6: el
    // cierre de una Session no cierra la Conversation).
    const session = Session.open(this.ids.next(), conversation.id, this.clock.now());
    try {
      await this.sessions.save(session);
    } catch (error) {
      // Carrera perdida (item 10 de auditoría): otra request concurrente ya
      // reabrió la Session activa antes que esta (índice único parcial,
      // 0015_sessions_one_active.sql) — se usa la Session ganadora en vez de
      // perder el mensaje entrante.
      if (error instanceof DomainError) {
        const winner = await this.sessions.findActiveByConversation(conversation.id);
        if (winner) return winner.id.toString();
      }
      throw error;
    }
    return session.id.toString();
  }
}
