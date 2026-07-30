import { Agent, Decision, Event, Funnel, Session } from "@/domain";

/**
 * ConversationHistoryEntry — un turno ya intercambiado de la Conversation
 * (memoria conversacional), reconstruido desde los Events "message.received"/
 * "message.sent" de todas las Sessions de la Conversation — mismo criterio de
 * proyección que ListConversationMessages (AA-01: sin tabla `message` paralela
 * al log de Events, que ya es la fuente de verdad).
 */
export interface ConversationHistoryEntry {
  readonly sender: "customer" | "agent";
  readonly text: string;
  readonly at: Date;
}

/**
 * ExecutionContext — el Context efímero del Modelo de Ejecución (SSOT Cap. 11
 * §6): una fotografía temporal del dominio construida para interpretar un Event.
 * Se construye para una ejecución específica y deja de existir al terminar.
 */
export interface ExecutionContext {
  readonly event: Event;
  readonly session: Session;
  readonly agent: Agent;
  readonly funnel: Funnel | null;
  /** Agregado de State/Memory/Variables relevante para la interpretación. */
  readonly snapshot: Record<string, unknown>;
  /**
   * Turnos previos de la Conversation (memoria conversacional), orden
   * cronológico ascendente, excluyendo el Event que se está interpretando.
   */
  readonly history: ReadonlyArray<ConversationHistoryEntry>;
}

/**
 * Puerto: Decision Engine (AA-02 — Decision Engine Independence).
 *
 * Abstrae el ORIGEN de la decisión. Una implementación puede decidir por reglas
 * de negocio, políticas del agente, workflows, intervención humana, un modelo de
 * IA (vía IReasoningProvider) o un clasificador. El dominio nunca depende
 * directamente de un LLM.
 *
 * `decide` interpreta el Event usando el Context y produce una Decision (SSOT
 * Cap. 11 §7–8). NO ejecuta acciones: la Decision contiene el plan; su
 * materialización pertenece a otro caso de uso (separación decidir/ejecutar,
 * SSOT Cap. 11 §14).
 */
export interface IDecisionEngine {
  decide(context: ExecutionContext): Promise<Decision>;
}
