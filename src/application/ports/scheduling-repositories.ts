import { Appointment, AppointmentTimelineEntry, Calendar, Identity } from "@/domain";

/** Puertos de persistencia del bounded context Scheduling (SCR-004 Agenda). */
export interface CalendarRepository {
  save(calendar: Calendar): Promise<void>;
  findById(id: Identity): Promise<Calendar | null>;
  listByTenant(tenantId: Identity): Promise<Calendar[]>;
}

export interface AppointmentSearchFilters {
  calendarId?: Identity;
  customerId?: Identity;
  status?: string;
  from?: Date;
  to?: Date;
}

export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(id: Identity): Promise<Appointment | null>;
  /** Reuniones activas (no eliminadas) del Calendar que se solapan con [startsAt, endsAt). */
  findOverlapping(
    calendarId: Identity,
    startsAt: Date,
    endsAt: Date,
    excludeId?: Identity,
  ): Promise<Appointment[]>;
  search(
    tenantId: Identity,
    filters: AppointmentSearchFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Appointment[]; total: number }>;
}

export interface AppointmentTimelineRepository {
  append(entry: AppointmentTimelineEntry): Promise<void>;
  findByAppointment(appointmentId: Identity): Promise<AppointmentTimelineEntry[]>;
}
