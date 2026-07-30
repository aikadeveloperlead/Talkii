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

/**
 * Distingue el motivo de un fallo del Reasoning Provider: "auth" (credencial
 * inválida, permanente — reintentar no ayuda) de "rate-limit" (transitorio —
 * un reintento con backoff sí podría servir) de "unknown" (el resto).
 */
export type ReasoningErrorKind = "auth" | "rate-limit" | "unknown";

/** Error tipado que los adaptadores concretos (Anthropic/OpenAI) deben lanzar. */
export class ReasoningProviderError extends Error {
  readonly kind: ReasoningErrorKind;

  constructor(message: string, kind: ReasoningErrorKind) {
    super(message);
    this.name = "ReasoningProviderError";
    this.kind = kind;
  }
}

/** Clasifica un status HTTP en el ReasoningErrorKind correspondiente. */
export function classifyReasoningError(status: number): ReasoningErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  return "unknown";
}
