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

/** CaptureField — Objeto de Valor (SCR-008 §3.5 "Captura de Datos"). */
export interface CaptureField {
  readonly key: string;
  readonly label: string;
}

/** Estados del ciclo de vida del Agent (SCR-008 §4.5 / BK-03: uno solo a la vez). */
export type AgentStatus = "draft" | "active" | "disabled" | "archived";

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
 *
 * SCR-008 (Agentes IA) añade los campos de persona/negocio de la pestaña
 * "General"/"Mensajes"/"Captura de Datos" — todos opcionales para no romper
 * la invariante existente. Deliberadamente NO incorpora la pestaña
 * "Configuración IA" del spec (model/api_provider/api_key/temperature/
 * max_tokens): esos campos acoplarían el Agent a un proveedor de IA concreto,
 * exactamente lo que `reasoningProfile` abstrae (AA-02) — permanecen a nivel
 * de infraestructura (`OpenAIReasoningProvider`, env vars), no en esta
 * entidad. El spec también refiere un "Workflow genérico de n8n" (n8n fue
 * removido por completo de la arquitectura de Talkii — ver ADR — sustituido
 * por el Decision Engine ya construido, SSOT Cap. 11); esas referencias no
 * aplican aquí.
 */
export interface AgentProps {
  tenantId: Identity;
  name: string;
  objective: string;
  permanentPrompt: string;
  policies: Policy[];
  /** Perfil de razonamiento abstracto (ej. "sales-default"), no un modelo LLM. */
  reasoningProfile: string;
  status?: AgentStatus;
  role?: string;
  personality?: string;
  language?: string;
  tone?: string;
  businessName?: string;
  businessDescription?: string;
  productsServices?: string;
  businessType?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
  transferKeywords?: string[];
  captureFields?: CaptureField[];
  /** SCR-010 FN-02: el Agent solo referencia un Funnel (FK simple, no N:N). */
  funnelId?: Identity;
}

export class Agent extends Entity {
  private constructor(
    id: Identity,
    private readonly props: AgentProps & { status: AgentStatus },
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
      status: props.status ?? "active",
      transferKeywords: props.transferKeywords ? [...props.transferKeywords] : [],
      captureFields: props.captureFields ? [...props.captureFields] : [],
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

  get status(): AgentStatus {
    return this.props.status;
  }

  get role(): string | undefined {
    return this.props.role;
  }

  get personality(): string | undefined {
    return this.props.personality;
  }

  get language(): string | undefined {
    return this.props.language;
  }

  get tone(): string | undefined {
    return this.props.tone;
  }

  get businessName(): string | undefined {
    return this.props.businessName;
  }

  get businessDescription(): string | undefined {
    return this.props.businessDescription;
  }

  get productsServices(): string | undefined {
    return this.props.productsServices;
  }

  get businessType(): string | undefined {
    return this.props.businessType;
  }

  get welcomeMessage(): string | undefined {
    return this.props.welcomeMessage;
  }

  get fallbackMessage(): string | undefined {
    return this.props.fallbackMessage;
  }

  get transferKeywords(): readonly string[] {
    return this.props.transferKeywords ?? [];
  }

  get captureFields(): readonly CaptureField[] {
    return this.props.captureFields ?? [];
  }

  get funnelId(): Identity | undefined {
    return this.props.funnelId;
  }

  withStatus(status: AgentStatus): Agent {
    return Agent.create(this.id, { ...this.props, status });
  }

  withFunnel(funnelId: Identity | undefined): Agent {
    return Agent.create(this.id, { ...this.props, funnelId });
  }

  withEdits(
    changes: Partial<
      Omit<AgentProps, "tenantId" | "reasoningProfile" | "status">
    >,
  ): Agent {
    return Agent.create(this.id, { ...this.props, ...changes });
  }
}
