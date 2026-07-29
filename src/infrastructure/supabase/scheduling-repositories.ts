import type { SupabaseClient } from "@supabase/supabase-js";
import { Appointment, AppointmentTimelineEntry, Calendar, Identity } from "@/domain";
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

export class SupabaseCalendarRepository implements CalendarRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(calendar: Calendar): Promise<void> {
    const { error } = await this.db.from("calendars").upsert(calendarToRow(calendar));
    if (error) fail("calendars.upsert", error);
  }

  async findById(id: Identity): Promise<Calendar | null> {
    const { data, error } = await this.db
      .from("calendars")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("calendars.select", error);
    return data ? rowToCalendar(data as CalendarRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Calendar[]> {
    const { data, error } = await this.db
      .from("calendars")
      .select("*")
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
    if (error) fail("appointments.upsert", error);
  }

  async findById(id: Identity): Promise<Appointment | null> {
    const { data, error } = await this.db
      .from("appointments")
      .select("*")
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
      .select("*")
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
      .select("*", { count: "exact" })
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
      .select("*")
      .eq("appointment_id", appointmentId.toString())
      .order("occurred_at", { ascending: true });
    if (error) fail("appointment_timeline.select", error);
    return (data as AppointmentTimelineRow[]).map(rowToTimelineEntry);
  }
}
