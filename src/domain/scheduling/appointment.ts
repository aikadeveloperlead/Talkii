import { Entity, Identity, invariant } from "../shared";

/**
 * Appointment — Entidad del bounded context Scheduling (SCR-004 Agenda).
 * `status` es el estado comercial de la reunión; `deletedAt` es un soft
 * delete independiente (SCR-004 Trigger 5 / DELETE endpoint: "Soft Delete,
 * nunca Hard Delete") — igual separación que Customer.archivedAt vs
 * Lead.status en CRM.
 */
export type AppointmentStatus = "scheduled" | "confirmed" | "cancelled" | "completed";

export interface AppointmentProps {
  tenantId: Identity;
  calendarId: Identity;
  customerId?: Identity;
  conversationId?: Identity;
  title: string;
  description?: string;
  status: AppointmentStatus;
  timezone: string;
  startsAt: Date;
  endsAt: Date;
  deletedAt?: Date;
}

export class Appointment extends Entity {
  private constructor(
    id: Identity,
    private readonly props: AppointmentProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: AppointmentProps): Appointment {
    invariant(props.title.trim().length > 0, "Appointment: el título no puede estar vacío");
    invariant(
      props.endsAt.getTime() > props.startsAt.getTime(),
      "Appointment: endsAt debe ser posterior a startsAt",
    );
    return new Appointment(id, { ...props, title: props.title.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get calendarId(): Identity {
    return this.props.calendarId;
  }
  get customerId(): Identity | undefined {
    return this.props.customerId;
  }
  get conversationId(): Identity | undefined {
    return this.props.conversationId;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get status(): AppointmentStatus {
    return this.props.status;
  }
  get timezone(): string {
    return this.props.timezone;
  }
  get startsAt(): Date {
    return this.props.startsAt;
  }
  get endsAt(): Date {
    return this.props.endsAt;
  }
  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== undefined;
  }

  withStatus(status: AppointmentStatus): Appointment {
    return Appointment.create(this.id, { ...this.props, status });
  }

  rescheduled(startsAt: Date, endsAt: Date): Appointment {
    return Appointment.create(this.id, { ...this.props, startsAt, endsAt });
  }

  deleted(deletedAt: Date): Appointment {
    return Appointment.create(this.id, { ...this.props, deletedAt });
  }

  /** Se solapa con otro rango [startsAt, endsAt) del mismo Calendar. */
  overlaps(startsAt: Date, endsAt: Date): boolean {
    return this.startsAt.getTime() < endsAt.getTime() && startsAt.getTime() < this.endsAt.getTime();
  }
}
