import { Entity, Identity, invariant } from "../shared";

/**
 * CustomerTimelineEntry — Entidad del bounded context CRM (SCR-003 §5
 * "Customer Timeline Service": construye el histórico consolidado del
 * Customer, "no almacena mensajes, integra eventos de múltiples módulos").
 *
 * Deliberadamente NO reutiliza la entidad núcleo `Event` (SSOT §8: un Event
 * pertenece a exactamente una Session — es del bounded context Execution
 * Runtime, no de CRM) ni proyecta sobre datos ya existentes: los hechos
 * comerciales (alta de cliente, cambio de lead, etiquetas) no existen en
 * ningún otro lugar del sistema, así que este log append-only es persistencia
 * genuinamente nueva y justificada por el dominio (AA-01).
 */
export interface CustomerTimelineEntryProps {
  customerId: Identity;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export class CustomerTimelineEntry extends Entity {
  private constructor(
    id: Identity,
    private readonly props: CustomerTimelineEntryProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: CustomerTimelineEntryProps): CustomerTimelineEntry {
    invariant(
      props.type.trim().length > 0,
      "CustomerTimelineEntry: debe declarar un tipo",
    );
    return new CustomerTimelineEntry(id, { ...props, payload: { ...props.payload } });
  }

  get customerId(): Identity {
    return this.props.customerId;
  }

  get type(): string {
    return this.props.type;
  }

  get payload(): Readonly<Record<string, unknown>> {
    return this.props.payload;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}
