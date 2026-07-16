import { DomainError, Identity } from "@/domain";
import { ExecutionContext, IDecisionEngine } from "../ports/decision-engine";
import {
  AgentRepository,
  ConversationRepository,
  DecisionRepository,
  EventRepository,
  FunnelRepository,
  SessionRepository,
} from "../ports/repositories";

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
  ) {}

  async execute(input: MakeDecisionInput): Promise<MakeDecisionResult> {
    const event = await this.events.findById(Identity.of(input.eventId));
    if (!event) {
      throw new DomainError("MakeDecision: el Event no existe");
    }

    const session = await this.sessions.findById(event.sessionId);
    if (!session) {
      throw new DomainError("MakeDecision: la Session del Event no existe");
    }

    const agent = await this.agents.findById(Identity.of(input.agentId));
    if (!agent) {
      throw new DomainError("MakeDecision: el Agent no existe");
    }

    const funnel = input.funnelId
      ? await this.funnels.findById(Identity.of(input.funnelId))
      : null;

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
    };

    // Interpretación + producción de la Decision (AA-02: el origen es abstracto).
    const decision = await this.engine.decide(context);

    if (!decision.eventId.equals(event.id)) {
      throw new DomainError(
        "MakeDecision: la Decision debe derivar del Event interpretado (SSOT §9)",
      );
    }

    await this.decisions.save(decision);

    return { decisionId: decision.id.toString() };
  }
}
