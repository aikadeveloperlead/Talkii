import { Decision, DomainError, Event, Identity, NotFoundError, Session } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { ReasoningProviderError } from "../ports/reasoning-provider";
import {
  ConversationHistoryEntry,
  ExecutionContext,
  IDecisionEngine,
} from "../ports/decision-engine";
import {
  AgentRepository,
  DecisionRepository,
  EventRepository,
  FunnelRepository,
  SessionRepository,
} from "../ports/repositories";

/** Tipos de Event que representan un turno de mensaje intercambiado. */
const MESSAGE_EVENT_TYPES: Record<string, "customer" | "agent"> = {
  "message.received": "customer",
  "message.sent": "agent",
};

/** Techo de turnos previos incluidos como memoria conversacional (evita prompts sin límite). */
const HISTORY_LIMIT = 20;

/** Primera transferKeyword del Agent que aparece (case-insensitive) en el texto del Event, o null. */
function matchTransferKeyword(event: Event, keywords: readonly string[]): string | null {
  const text = typeof event.payload.text === "string" ? event.payload.text.toLowerCase() : "";
  if (!text) return null;
  return keywords.find((k) => k.trim() && text.includes(k.trim().toLowerCase())) ?? null;
}

/**
 * MakeDecision — núcleo del comportamiento (SSOT Cap. 11 §6–8).
 *
 * Dado un Event ya registrado: construye el Context efímero (State/Memory/
 * Session/Agent/Funnel), lo entrega al Decision Engine y persiste la Decision
 * resultante.
 *
 * Respeta la separación decidir/ejecutar (SSOT Cap. 11 §14): produce la Decision
 * con su plan de Actions pero NO las ejecuta. La materialización del plan es un
 * caso de uso posterior.
 */
export interface MakeDecisionInput {
  eventId: string;
  agentId: string;
  funnelId?: string;
}

export interface MakeDecisionResult {
  decisionId: string;
}

export class MakeDecision {
  constructor(
    private readonly engine: IDecisionEngine,
    private readonly events: EventRepository,
    private readonly sessions: SessionRepository,
    private readonly agents: AgentRepository,
    private readonly funnels: FunnelRepository,
    private readonly decisions: DecisionRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: MakeDecisionInput): Promise<MakeDecisionResult> {
    const event = await this.events.findById(Identity.of(input.eventId));
    if (!event) {
      throw new NotFoundError("MakeDecision: el Event no existe");
    }

    const session = await this.sessions.findById(event.sessionId);
    if (!session) {
      throw new NotFoundError("MakeDecision: la Session del Event no existe");
    }

    const agent = await this.agents.findById(Identity.of(input.agentId));
    if (!agent) {
      throw new NotFoundError("MakeDecision: el Agent no existe");
    }

    const funnel = input.funnelId
      ? await this.funnels.findById(Identity.of(input.funnelId))
      : null;

    const history = await this.buildHistory(session, event.id);

    // Transferencia a operador (business-rule, sin motor de razonamiento) —
    // hallazgo de auditoría (item 10): transferKeywords se guardaba en el
    // Agent pero el runtime nunca lo leía. Coincidencia case-insensitive
    // contra el texto del Event; reutiliza operatorControl (ya establecido
    // por SetOperatorControl/HandleInboundMessage) en vez de inventar un
    // mecanismo de hand-off nuevo.
    const matchedKeyword = matchTransferKeyword(event, agent.transferKeywords);
    if (matchedKeyword) {
      await this.sessions.save(session.withOperatorControl(true));
      const decision = Decision.create(this.ids.next(), {
        sessionId: session.id,
        eventId: event.id,
        source: "business-rule",
        rationale: `Transferencia a operador: palabra clave "${matchedKeyword}" detectada`,
        actions: [],
      });
      await this.decisions.save(decision);
      return { decisionId: decision.id.toString() };
    }

    // Mensaje de bienvenida determinista en el primer turno de la
    // Conversation — mismo hallazgo (welcomeMessage sin leer). `history`
    // vacío significa que no hubo turnos previos en ninguna Session de la
    // Conversation: es el primer contacto del cliente.
    if (history.length === 0 && agent.welcomeMessage) {
      const decision = Decision.create(this.ids.next(), {
        sessionId: session.id,
        eventId: event.id,
        source: "business-rule",
        rationale: "Primer turno de la Conversation: mensaje de bienvenida configurado",
        actions: [{ type: "message.send", params: { text: agent.welcomeMessage } }],
      });
      await this.decisions.save(decision);
      return { decisionId: decision.id.toString() };
    }

    // Construcción del Context efímero (SSOT Cap. 11 §6).
    const context: ExecutionContext = {
      event,
      session,
      agent,
      funnel,
      snapshot: {
        state: session.state,
        memory: session.dimensions.memory,
        variables: session.dimensions.variables,
      },
      history,
    };

    // Interpretación + producción de la Decision (AA-02: el origen es abstracto).
    let decision;
    try {
      decision = await this.engine.decide(context);
    } catch (error) {
      // Hallazgo de auditoría (item 10): un fallo del Reasoning Provider no
      // debe perder el mensaje sin dejar rastro. Se deja un Event consultable
      // en el mismo log que ya usa ListConversationMessages/buildHistory
      // (AA-01 — sin tabla nueva).
      await this.events.append(
        Event.create(this.ids.next(), {
          sessionId: session.id,
          type: "reasoning.failed",
          occurredAt: this.clock.now(),
          payload: {
            eventId: event.id.toString(),
            agentId: agent.id.toString(),
            error: error instanceof Error ? error.message : String(error),
            errorKind: error instanceof ReasoningProviderError ? error.kind : "unknown",
          },
        }),
      );
      // fallbackMessage configurado (mismo hallazgo que welcomeMessage/
      // transferKeywords): el cliente recibe una respuesta en vez de silencio
      // total. Sin fallbackMessage, se preserva el comportamiento previo
      // (relanzar — el caller decide cómo responder al fallo).
      if (!agent.fallbackMessage) {
        throw error;
      }
      decision = Decision.create(this.ids.next(), {
        sessionId: session.id,
        eventId: event.id,
        source: "business-rule",
        rationale: `Reasoning Provider falló, se usa fallbackMessage configurado: ${
          error instanceof Error ? error.message : String(error)
        }`,
        actions: [{ type: "message.send", params: { text: agent.fallbackMessage } }],
      });
    }

    if (!decision.eventId.equals(event.id)) {
      throw new DomainError(
        "MakeDecision: la Decision debe derivar del Event interpretado (SSOT §9)",
      );
    }

    await this.decisions.save(decision);

    return { decisionId: decision.id.toString() };
  }

  /**
   * Reconstruye los turnos previos de la Conversation entera (todas sus
   * Sessions, activas o cerradas — una relación puede reabrir Sessions) a
   * partir de los Events ya registrados, excluyendo el Event que se está
   * interpretando. Mismo criterio de proyección que ListConversationMessages
   * (AA-01): sin tabla `message` paralela al log de Events.
   */
  private async buildHistory(
    session: Session,
    currentEventId: Identity,
  ): Promise<ConversationHistoryEntry[]> {
    const sessions = await this.sessions.findAllByConversation(session.conversationId);

    const events = await this.events.findBySessions(sessions.map((s) => s.id));
    const turns: ConversationHistoryEntry[] = [];
    for (const e of events) {
      if (e.id.equals(currentEventId)) continue;
      const sender = MESSAGE_EVENT_TYPES[e.type];
      if (!sender) continue;
      const text = typeof e.payload.text === "string" ? e.payload.text : "";
      if (!text) continue;
      turns.push({ sender, text, at: e.occurredAt });
    }

    turns.sort((a, b) => a.at.getTime() - b.at.getTime());
    return turns.slice(-HISTORY_LIMIT);
  }
}
