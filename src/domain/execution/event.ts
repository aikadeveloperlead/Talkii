import { Entity, Identity, invariant } from "../shared";

/**
 * Event — Entidad de Dominio (SSOT Cap. 7 §8).
 *
 * Representa un hecho consumado ocurrido dentro del sistema. Los Events son el
 * punto de inicio de toda evolución del dominio.
 *
 * El Event NO contiene decisiones, lógica, comportamiento ni reglas de negocio.
 *
 * Invariantes (SSOT §8): pertenece a exactamente una Session; posee un instante
 * temporal; representa un hecho consumado; un Event nunca modifica directamente
 * el dominio.
 */
export interface EventProps {
  sessionId: Identity;
  /** Tipo de hecho, ej. "message.received", "message.delivered". */
  type: string;
  occurredAt: Date;
  /** Datos inmutables del hecho. El Event no interpreta este payload. */
  payload: Record<string, unknown>;
  /**
   * Identidad del hecho en el sistema de origen (p. ej. el `wamid` de Meta).
   * Opcional: los hechos internos no la tienen. Fundamento de la idempotencia
   * ante reintentos del canal externo.
   */
  externalId?: string;
}

export class Event extends Entity {
  private constructor(
    id: Identity,
    private readonly props: EventProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: EventProps): Event {
    invariant(props.type.trim().length > 0, "Event: debe declarar un tipo");
    invariant(
      props.occurredAt instanceof Date && !Number.isNaN(props.occurredAt.getTime()),
      "Event: debe poseer un instante temporal válido",
    );
    return new Event(id, { ...props, payload: { ...props.payload } });
  }

  get sessionId(): Identity {
    return this.props.sessionId;
  }

  get type(): string {
    return this.props.type;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get payload(): Readonly<Record<string, unknown>> {
    return this.props.payload;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }
}
