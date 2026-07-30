import { AppointmentTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { AppointmentRepository, AppointmentTimelineRepository } from "../ports/scheduling-repositories";

/** DeleteAppointment — SCR-004 §7 DELETE /appointments/:id ("Soft Delete, nunca Hard Delete"). */
export class DeleteAppointment {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly appointments: AppointmentRepository,
    private readonly timeline: AppointmentTimelineRepository,
  ) {}

  async execute(appointmentId: string): Promise<void> {
    const appointment = await this.appointments.findById(Identity.of(appointmentId));
    if (!appointment) {
      throw new DomainError("DeleteAppointment: el Appointment no existe");
    }

    await this.appointments.save(appointment.deleted(this.clock.now()));

    await this.timeline.append(
      AppointmentTimelineEntry.create(this.ids.next(), {
        appointmentId: appointment.id,
        type: "appointment.deleted",
        payload: {},
        occurredAt: this.clock.now(),
      }),
    );
  }
}
