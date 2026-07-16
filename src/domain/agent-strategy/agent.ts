import { Entity, Identity, invariant } from "../shared";

/**
 * Policy — Objeto de Valor (SSOT Cap. 7 §11): capacidad estratégica del Agent,
 * NO una entidad independiente. Describe una restricción o directiva de
 * comportamiento; no ejecuta ni decide.
 */
export interface Policy {
  readonly name: string;
  readonly rule: string;
}

/**
 * Agent — Entidad Estratégica (SSOT Cap. 7 §5).
 *
 * Representa una estrategia conversacional persistente y configurable. Encapsula
 * el comportamiento esperado del sistema. NO es un LLM, ni un chatbot, ni un
 * empleado humano.
 *
 * El Agent gobierna: identidad, objetivos, prompt permanente, políticas,
 * restricciones, capacidades, herramientas, modelo de razonamiento asociado.
 * El Agent NO gobierna: conversaciones, sesiones, eventos, decisiones,
 * ejecución ni interfaz.
 *
 * Invariante AA-02 / SSOT §5: la identidad del Agent es independiente del
 * proveedor de IA. Por eso `reasoningProfile` es una referencia abstracta
 * (una etiqueta de perfil), nunca un modelo LLM concreto.
 */
export interface AgentProps {
  tenantId: Identity;
  name: string;
  objective: string;
  permanentPrompt: string;
  policies: Policy[];
  /** Perfil de razonamiento abstracto (ej. "sales-default"), no un modelo LLM. */
  reasoningProfile: string;
}

export class Agent extends Entity {
  private constructor(
    id: Identity,
    private readonly props: AgentProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: AgentProps): Agent {
    invariant(
      props.name.trim().length > 0,
      "Agent: el nombre no puede estar vacío",
    );
    invariant(
      props.objective.trim().length > 0,
      "Agent: debe declarar un objetivo",
    );
    invariant(
      props.reasoningProfile.trim().length > 0,
      "Agent: debe tener un perfil de razonamiento abstracto",
    );
    return new Agent(id, {
      ...props,
      name: props.name.trim(),
      objective: props.objective.trim(),
      policies: [...props.policies],
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get objective(): string {
    return this.props.objective;
  }

  get permanentPrompt(): string {
    return this.props.permanentPrompt;
  }

  get policies(): readonly Policy[] {
    return this.props.policies;
  }

  get reasoningProfile(): string {
    return this.props.reasoningProfile;
  }
}
