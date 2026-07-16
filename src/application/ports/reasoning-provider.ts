/**
 * Puerto: Reasoning Service (SSOT Cap. 11 §16, Cap. 5 §19).
 *
 * Capacidad de razonamiento ABSTRACTA. El dominio solo conoce este puerto, no
 * un proveedor concreto: OpenAI, Anthropic o Google lo implementan sin cambiar
 * el comportamiento conceptual del sistema.
 *
 * AA-02: el razonamiento es un servicio, no el centro del sistema. Este puerto
 * es UNO de los mecanismos que puede alimentar al Decision Engine, nunca una
 * dependencia directa del dominio.
 */
export interface ReasoningRequest {
  /** Perfil de razonamiento abstracto del Agent (ej. "sales-default"). */
  readonly profile: string;
  /** Instrucciones permanentes: prompt del Agent + objetivo vigente. */
  readonly instructions: string;
  /** Situación concreta a interpretar (ej. el mensaje recibido). */
  readonly input: string;
  /** Contexto efímero relevante para la interpretación. */
  readonly context: Record<string, unknown>;
}

export interface ReasoningResult {
  readonly output: string;
  readonly metadata: Record<string, unknown>;
}

export interface IReasoningProvider {
  reason(request: ReasoningRequest): Promise<ReasoningResult>;
}
