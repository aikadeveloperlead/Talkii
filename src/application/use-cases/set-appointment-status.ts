import { AppointmentTimelineEntry, DomainError, Identity, type AppointmentStatus } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { AppointmentRepository, AppointmentTimelineRepository } from "../ports/scheduling-repositories";

/**
 * SetAppointmentStatus — SCR-004 §7 PATCH /appointments/:id/status y los
 * atajos POST /appointments/:id/confirm|cancel|complete (misma operación,
 * status fijo — evita duplicar lógica de transición).
 */
export class SetAppointmentStatus {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly appointments: AppointmentRepository,
    private readonly timeline: AppointmentTimelineRepository,
  ) {}

  async execute(appointmentId: string, status: AppointmentStatus): Promise<void> {
    const appointment = await this.appointments.findById(Identity.of(appointmentId));
    if (!appointment) {
      throw new DomainError("SetAppointmentStatus: el Appointment no existe");
    }

    await this.appointments.save(appointment.withStatus(status));

    await this.timeline.append(
      AppointmentTimelineEntry.create(this.ids.next(), {
        appointmentId: appointment.id,
        type: `appointment.${status}`,
        payload: {},
        occurredAt: this.clock.now(),
      }),
    );
  }
}
