import { Entity, Identity, invariant } from "../shared";

/**
 * Dimensiones internas de la Session (SSOT Cap. 7 §11: excluidas como
 * entidades — son dimensiones de valor sin identidad propia).
 *
 * - State: dimensión operativa (el estado activo).
 * - Memory: información recordada a lo largo de la interacción.
 * - Context: reconstruido dinámicamente en ejecución (aquí, su snapshot).
 * - Timeline: dimensión cronológica de hechos.
 */
export type SessionStatus = "active" | "closed";

export interface SessionState {
  readonly status: SessionStatus;
  readonly stage?: string;
}

export interface SessionDimensions {
  readonly state: SessionState;
  readonly memory: Record<string, unknown>;
  readonly context: Record<string, unknown>;
  readonly timeline: ReadonlyArray<{ at: Date; kind: string }>;
  readonly variables: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

/**
 * Session — Entidad Operativa (SSOT Cap. 7 §7).
 *
 * Unidad operativa sobre la que evoluciona una interacción continua. Concentra
 * el estado operativo para ejecutar una estrategia conversacional.
 *
 * La Session gobierna EXCLUSIVAMENTE: State, Memory, Context, Timeline,
 * Variables, Metadata. NO gobierna la identidad del Agent, la definición del
 * Funnel ni la configuración del Tenant.
 *
 * Invariantes (SSOT §7): pertenece a una única Conversation; posee exactamente
 * un State activo; mantiene un único Timeline.
 */
export interface SessionProps {
  conversationId: Identity;
  dimensions: SessionDimensions;
}

export class Session extends Entity {
  private constructor(
    id: Identity,
    private readonly props: SessionProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: SessionProps): Session {
    invariant(
      props.dimensions.state !== undefined,
      "Session: debe poseer exactamente un State activo",
    );
    return new Session(id, props);
  }

  /** Abre una Session nueva sobre una Conversation, con las dimensiones en su estado inicial. */
  static open(id: Identity, conversationId: Identity, startedAt: Date): Session {
    return Session.create(id, {
      conversationId,
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: startedAt, kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
  }

  get conversationId(): Identity {
    return this.props.conversationId;
  }

  get state(): SessionState {
    return this.props.dimensions.state;
  }

  get dimensions(): SessionDimensions {
    return this.props.dimensions;
  }

  get isActive(): boolean {
    return this.props.dimensions.state.status === "active";
  }

  /** Instante del hecho más reciente del Timeline, o undefined si aún no hay ninguno. */
  get lastActivityAt(): Date | undefined {
    const timeline = this.props.dimensions.timeline;
    return timeline.length ? timeline[timeline.length - 1].at : undefined;
  }

  /** Bandera operativa (SCR-002 Estado 8): true mientras un operador humano tiene el control. */
  get operatorControl(): boolean {
    return this.props.dimensions.metadata.operatorControl === true;
  }

  withOperatorControl(enabled: boolean): Session {
    return Session.create(this.id, {
      ...this.props,
      dimensions: {
        ...this.props.dimensions,
        metadata: { ...this.props.dimensions.metadata, operatorControl: enabled },
      },
    });
  }

  /** Agrega un hecho al Timeline (dimensión cronológica) sin tocar el resto. */
  withTimelineEntry(entry: { at: Date; kind: string }): Session {
    return Session.create(this.id, {
      ...this.props,
      dimensions: {
        ...this.props.dimensions,
        timeline: [...this.props.dimensions.timeline, entry],
      },
    });
  }

  /** Cierra la Session (item MEDIO de auditoría: SessionStatus="closed" nunca se producía). */
  close(at: Date): Session {
    return Session.create(this.id, {
      ...this.props,
      dimensions: {
        ...this.props.dimensions,
        state: { ...this.props.dimensions.state, status: "closed" },
      },
    }).withTimelineEntry({ at, kind: "session.closed" });
  }
}
