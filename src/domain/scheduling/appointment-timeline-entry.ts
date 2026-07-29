import { Entity, Identity, invariant } from "../shared";

/**
 * AppointmentTimelineEntry — log append-only del ciclo de vida de un
 * Appointment (SCR-004 §5 Timeline Service). Mismo razonamiento que
 * CustomerTimelineEntry: estos hechos no existen en ningún otro lugar del
 * sistema, así que la persistencia es genuinamente nueva (AA-01).
 */
export interface AppointmentTimelineEntryProps {
  appointmentId: Identity;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export class AppointmentTimelineEntry extends Entity {
  private constructor(
    id: Identity,
    private readonly props: AppointmentTimelineEntryProps,
  ) {
    super(id);
  }

  static create(
    id: Identity,
    props: AppointmentTimelineEntryProps,
  ): AppointmentTimelineEntry {
    invariant(props.type.trim().length > 0, "AppointmentTimelineEntry: debe declarar un tipo");
    return new AppointmentTimelineEntry(id, { ...props, payload: { ...props.payload } });
  }

  get appointmentId(): Identity {
    return this.props.appointmentId;
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
