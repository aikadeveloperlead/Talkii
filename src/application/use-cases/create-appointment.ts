import { Appointment, AppointmentTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import {
  AppointmentRepository,
  AppointmentTimelineRepository,
  CalendarRepository,
} from "../ports/scheduling-repositories";
import type { CustomerTimelineRepository } from "../ports/crm-repositories";
import { CustomerTimelineEntry } from "@/domain";

/**
 * CreateAppointment — SCR-004 §7 POST /appointments ("Validar disponibilidad
 * → Crear Appointment → Crear Timeline → ... → Publicar Realtime").
 *
 * Trigger 1 del spec ("Nueva reunión → Crear Timeline → Actualizar Customer")
 * se resuelve reutilizando el puerto CustomerTimelineRepository ya construido
 * en CRM (SCR-003) — cooperación entre bounded contexts vía puertos
 * existentes, sin duplicar infraestructura.
 */
export interface CreateAppointmentInput {
  tenantId: string;
  calendarId: string;
  customerId?: string;
  conversationId?: string;
  title: string;
  description?: string;
  timezone: string;
  startsAt: Date;
  endsAt: Date;
}

export class CreateAppointment {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendars: CalendarRepository,
    private readonly appointments: AppointmentRepository,
    private readonly timeline: AppointmentTimelineRepository,
    private readonly customerTimeline: CustomerTimelineRepository,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<{ appointmentId: string }> {
    const calendarId = Identity.of(input.calendarId);
    const calendar = await this.calendars.findById(calendarId);
    if (!calendar) {
      throw new DomainError("CreateAppointment: el Calendar no existe");
    }

    const overlapping = await this.appointments.findOverlapping(
      calendarId,
      input.startsAt,
      input.endsAt,
    );
    if (overlapping.length > 0) {
      throw new DomainError("CreateAppointment: el horario no está disponible (Time Conflict)");
    }

    const appointment = Appointment.create(this.ids.next(), {
      tenantId: Identity.of(input.tenantId),
      calendarId,
      customerId: input.customerId ? Identity.of(input.customerId) : undefined,
      conversationId: input.conversationId ? Identity.of(input.conversationId) : undefined,
      title: input.title,
      description: input.description,
      status: "scheduled",
      timezone: input.timezone,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    await this.appointments.save(appointment);

    await this.timeline.append(
      AppointmentTimelineEntry.create(this.ids.next(), {
        appointmentId: appointment.id,
        type: "appointment.created",
        payload: { title: appointment.title },
        occurredAt: this.clock.now(),
      }),
    );

    if (appointment.customerId) {
      await this.customerTimeline.append(
        CustomerTimelineEntry.create(this.ids.next(), {
          customerId: appointment.customerId,
          type: "appointment.scheduled",
          payload: { appointmentId: appointment.id.toString(), title: appointment.title },
          occurredAt: this.clock.now(),
        }),
      );
    }

    return { appointmentId: appointment.id.toString() };
  }
}
