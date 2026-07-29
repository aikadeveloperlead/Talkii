import { Identity } from "@/domain";
import { AppointmentRepository, AppointmentTimelineRepository } from "../ports/scheduling-repositories";

/** GetAppointmentDetail — SCR-004 §7 GET /appointments/:id. */
export class GetAppointmentDetail {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly timeline: AppointmentTimelineRepository,
  ) {}

  async execute(appointmentId: string) {
    const appointment = await this.appointments.findById(Identity.of(appointmentId));
    if (!appointment) return null;

    const entries = await this.timeline.findByAppointment(appointment.id);
    return {
      id: appointment.id.toString(),
      calendarId: appointment.calendarId.toString(),
      customerId: appointment.customerId?.toString(),
      conversationId: appointment.conversationId?.toString(),
      title: appointment.title,
      description: appointment.description,
      status: appointment.status,
      timezone: appointment.timezone,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      deleted: appointment.isDeleted,
      timeline: entries
        .map((e) => ({ id: e.id.toString(), type: e.type, payload: e.payload, at: e.occurredAt }))
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    };
  }
}
