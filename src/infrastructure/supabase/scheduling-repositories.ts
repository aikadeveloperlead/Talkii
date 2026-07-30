import type { SupabaseClient } from "@supabase/supabase-js";
import { Appointment, AppointmentTimelineEntry, Calendar, DomainError, Identity } from "@/domain";
import type {
  AppointmentRepository,
  AppointmentSearchFilters,
  AppointmentTimelineRepository,
  CalendarRepository,
} from "@/application/ports";
import {
  appointmentToRow,
  calendarToRow,
  rowToAppointment,
  rowToCalendar,
  rowToTimelineEntry,
  timelineEntryToRow,
  type AppointmentRow,
  type AppointmentTimelineRow,
  type CalendarRow,
} from "./scheduling-mappers";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

/** Item BAJO #21 de la auditoría: columnas explícitas en vez de select("*"). */
const CALENDAR_COLUMNS = "id,tenant_id,name,timezone,color,is_default";
const APPOINTMENT_COLUMNS =
  "id,tenant_id,calendar_id,customer_id,conversation_id,title,description,status,timezone,starts_at,ends_at,deleted_at";
const APPOINTMENT_TIMELINE_COLUMNS = "id,appointment_id,type,payload,occurred_at";

export class SupabaseCalendarRepository implements CalendarRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(calendar: Calendar): Promise<void> {
    const { error } = await this.db.from("calendars").upsert(calendarToRow(calendar));
    if (error) fail("calendars.upsert", error);
  }

  async findById(id: Identity): Promise<Calendar | null> {
    const { data, error } = await this.db
      .from("calendars")
      .select(CALENDAR_COLUMNS)
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("calendars.select", error);
    return data ? rowToCalendar(data as CalendarRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Calendar[]> {
    const { data, error } = await this.db
      .from("calendars")
      .select(CALENDAR_COLUMNS)
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("calendars.select", error);
    return (data as CalendarRow[]).map(rowToCalendar);
  }
}

export class SupabaseAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(appointment: Appointment): Promise<void> {
    const { error } = await this.db.from("appointments").upsert(appointmentToRow(appointment));
    if (error) {
      // Postgres 23P01 (exclusion_violation): choca con appointments_no_overlap
      // (0013_appointments_no_overlap.sql) — cierra la ventana de carrera del
      // check-then-insert de findOverlapping (item 10 de auditoría).
      if ((error as { code?: string }).code === "23P01") {
        throw new DomainError(
          "Appointment: se solapa con otra cita existente en el mismo Calendar",
        );
      }
      fail("appointments.upsert", error);
    }
  }

  async findById(id: Identity): Promise<Appointment | null> {
    const { data, error } = await this.db
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("appointments.select", error);
    return data ? rowToAppointment(data as AppointmentRow) : null;
  }

  async findOverlapping(
    calendarId: Identity,
    startsAt: Date,
    endsAt: Date,
    excludeId?: Identity,
  ): Promise<Appointment[]> {
    let query = this.db
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("calendar_id", calendarId.toString())
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());
    if (excludeId) query = query.neq("id", excludeId.toString());

    const { data, error } = await query;
    if (error) fail("appointments.select", error);
    return (data as AppointmentRow[]).map(rowToAppointment);
  }

  async search(
    tenantId: Identity,
    filters: AppointmentSearchFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Appointment[]; total: number }> {
    let query = this.db
      .from("appointments")
      .select(APPOINTMENT_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId.toString())
      .is("deleted_at", null);

    if (filters.calendarId) query = query.eq("calendar_id", filters.calendarId.toString());
    if (filters.customerId) query = query.eq("customer_id", filters.customerId.toString());
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("starts_at", filters.from.toISOString());
    if (filters.to) query = query.lte("starts_at", filters.to.toISOString());

    const start = (page - 1) * limit;
    const { data, error, count } = await query
      .order("starts_at", { ascending: true })
      .range(start, start + limit - 1);
    if (error) fail("appointments.select", error);

    return { items: (data as AppointmentRow[]).map(rowToAppointment), total: count ?? 0 };
  }
}

export class SupabaseAppointmentTimelineRepository implements AppointmentTimelineRepository {
  constructor(private readonly db: SupabaseClient) {}

  async append(entry: AppointmentTimelineEntry): Promise<void> {
    const { error } = await this.db
      .from("appointment_timeline")
      .insert(timelineEntryToRow(entry));
    if (error) fail("appointment_timeline.insert", error);
  }

  async findByAppointment(appointmentId: Identity): Promise<AppointmentTimelineEntry[]> {
    const { data, error } = await this.db
      .from("appointment_timeline")
      .select(APPOINTMENT_TIMELINE_COLUMNS)
      .eq("appointment_id", appointmentId.toString())
      .order("occurred_at", { ascending: true });
    if (error) fail("appointment_timeline.select", error);
    return (data as AppointmentTimelineRow[]).map(rowToTimelineEntry);
  }
}
