import { Entity, Identity, invariant } from "../shared";

/**
 * Action — Objeto de Valor: un curso de acción producido por una Decision.
 * SSOT Cap. 7 §11 / Cap. 6: las Acciones son el producto de la Decision y
 * modifican el dominio al ejecutarse, pero no son entidades del núcleo.
 */
export interface Action {
  readonly type: string;
  readonly params: Record<string, unknown>;
}

/**
 * Origen de una Decision. AA-02 (Decision Engine Independence): una decisión
 * puede provenir de reglas de negocio, políticas, workflows, humanos,
 * clasificadores o un modelo de IA. El LLM es solo UNO de los mecanismos; el
 * dominio nunca depende directamente de él.
 */
export type DecisionSource =
  | "business-rule"
  | "agent-policy"
  | "workflow"
  | "human"
  | "ai-model"
  | "classifier"
  | "deterministic-engine";

/**
 * Decision — Entidad de Dominio (SSOT Cap. 7 §9).
 *
 * Resultado de interpretar un Event usando Contexto, Estado, Memoria y la
 * Estrategia vigente. Es el punto central del comportamiento del sistema.
 *
 * Invariantes (SSOT §9): deriva de un único Event; nunca ejecuta acciones
 * directamente (solo produce un plan de Actions); siempre precede a cualquier
 * Action significativa; debe mantener trazabilidad (source + rationale).
 */
export interface DecisionProps {
  sessionId: Identity;
  eventId: Identity;
  source: DecisionSource;
  /** Justificación trazable del comportamiento del sistema. */
  rationale: string;
  /** Plan de acciones; la Decision no las ejecuta, solo las determina. */
  actions: Action[];
}

export class Decision extends Entity {
  private constructor(
    id: Identity,
    private readonly props: DecisionProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: DecisionProps): Decision {
    invariant(
      props.rationale.trim().length > 0,
      "Decision: debe mantener trazabilidad (rationale no vacío)",
    );
    return new Decision(id, {
      ...props,
      actions: [...props.actions],
    });
  }

  get sessionId(): Identity {
    return this.props.sessionId;
  }

  /** Toda Decision deriva de un único Event (SSOT §9). */
  get eventId(): Identity {
    return this.props.eventId;
  }

  get source(): DecisionSource {
    return this.props.source;
  }

  get rationale(): string {
    return this.props.rationale;
  }

  get actions(): readonly Action[] {
    return this.props.actions;
  }
}
