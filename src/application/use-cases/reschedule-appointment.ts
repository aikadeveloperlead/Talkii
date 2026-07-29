import { AppointmentTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { AppointmentRepository, AppointmentTimelineRepository } from "../ports/scheduling-repositories";

/** RescheduleAppointment — SCR-004 §7 PATCH /appointments/:id/reschedule ("Validar conflicto → Actualizar → Timeline"). */
export interface RescheduleAppointmentInput {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
}

export class RescheduleAppointment {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly appointments: AppointmentRepository,
    private readonly timeline: AppointmentTimelineRepository,
  ) {}

  async execute(input: RescheduleAppointmentInput): Promise<void> {
    const appointmentId = Identity.of(input.appointmentId);
    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment) {
      throw new DomainError("RescheduleAppointment: el Appointment no existe");
    }

    const overlapping = await this.appointments.findOverlapping(
      appointment.calendarId,
      input.startsAt,
      input.endsAt,
      appointmentId,
    );
    if (overlapping.length > 0) {
      throw new DomainError("RescheduleAppointment: el nuevo horario no está disponible (Time Conflict)");
    }

    await this.appointments.save(appointment.rescheduled(input.startsAt, input.endsAt));

    await this.timeline.append(
      AppointmentTimelineEntry.create(this.ids.next(), {
        appointmentId,
        type: "appointment.rescheduled",
        payload: { startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() },
        occurredAt: this.clock.now(),
      }),
    );
  }
}
