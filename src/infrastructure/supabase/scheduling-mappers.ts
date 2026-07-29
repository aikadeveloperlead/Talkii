import {
  Appointment,
  AppointmentTimelineEntry,
  Calendar,
  Identity,
  type AppointmentStatus,
} from "@/domain";

export interface CalendarRow {
  id: string;
  tenant_id: string;
  name: string;
  timezone: string;
  color: string | null;
  is_default: boolean;
}
export function calendarToRow(calendar: Calendar): CalendarRow {
  return {
    id: calendar.id.toString(),
    tenant_id: calendar.tenantId.toString(),
    name: calendar.name,
    timezone: calendar.timezone,
    color: calendar.color ?? null,
    is_default: calendar.isDefault,
  };
}
export function rowToCalendar(row: CalendarRow): Calendar {
  return Calendar.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    timezone: row.timezone,
    color: row.color ?? undefined,
    isDefault: row.is_default,
  });
}

export interface AppointmentRow {
  id: string;
  tenant_id: string;
  calendar_id: string;
  customer_id: string | null;
  conversation_id: string | null;
  title: string;
  description: string | null;
  status: AppointmentStatus;
  timezone: string;
  starts_at: string;
  ends_at: string;
  deleted_at: string | null;
}
export function appointmentToRow(appointment: Appointment): AppointmentRow {
  return {
    id: appointment.id.toString(),
    tenant_id: appointment.tenantId.toString(),
    calendar_id: appointment.calendarId.toString(),
    customer_id: appointment.customerId?.toString() ?? null,
    conversation_id: appointment.conversationId?.toString() ?? null,
    title: appointment.title,
    description: appointment.description ?? null,
    status: appointment.status,
    timezone: appointment.timezone,
    starts_at: appointment.startsAt.toISOString(),
    ends_at: appointment.endsAt.toISOString(),
    deleted_at: appointment.deletedAt ? appointment.deletedAt.toISOString() : null,
  };
}
export function rowToAppointment(row: AppointmentRow): Appointment {
  return Appointment.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    calendarId: Identity.of(row.calendar_id),
    customerId: row.customer_id ? Identity.of(row.customer_id) : undefined,
    conversationId: row.conversation_id ? Identity.of(row.conversation_id) : undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    timezone: row.timezone,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
  });
}

export interface AppointmentTimelineRow {
  id: string;
  appointment_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}
export function timelineEntryToRow(entry: AppointmentTimelineEntry): AppointmentTimelineRow {
  return {
    id: entry.id.toString(),
    appointment_id: entry.appointmentId.toString(),
    type: entry.type,
    payload: { ...entry.payload },
    occurred_at: entry.occurredAt.toISOString(),
  };
}
export function rowToTimelineEntry(row: AppointmentTimelineRow): AppointmentTimelineEntry {
  return AppointmentTimelineEntry.create(Identity.of(row.id), {
    appointmentId: Identity.of(row.appointment_id),
    type: row.type,
    payload: row.payload ?? {},
    occurredAt: new Date(row.occurred_at),
  });
}
