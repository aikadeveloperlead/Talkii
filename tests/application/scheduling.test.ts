import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain";
import {
  CreateAppointment,
  CreateCalendar,
  DeleteAppointment,
  GetAppointmentDetail,
  ListAppointments,
  ListCalendars,
  RescheduleAppointment,
  SetAppointmentStatus,
} from "@/application/use-cases";
import {
  FixedClock,
  InMemoryAppointmentTimeline,
  InMemoryAppointments,
  InMemoryCalendars,
  InMemoryCustomerTimeline,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const calendars = new InMemoryCalendars();
  const appointments = new InMemoryAppointments();
  const timeline = new InMemoryAppointmentTimeline();
  const customerTimeline = new InMemoryCustomerTimeline();

  return {
    ids,
    clock,
    calendars,
    appointments,
    timeline,
    customerTimeline,
    createCalendar: new CreateCalendar(ids, calendars),
    listCalendars: new ListCalendars(calendars),
    createAppointment: new CreateAppointment(
      ids,
      clock,
      calendars,
      appointments,
      timeline,
      customerTimeline,
    ),
    getDetail: new GetAppointmentDetail(appointments, timeline),
    listAppointments: new ListAppointments(appointments),
    setStatus: new SetAppointmentStatus(ids, clock, appointments, timeline),
    reschedule: new RescheduleAppointment(ids, clock, appointments, timeline),
    deleteAppointment: new DeleteAppointment(ids, clock, appointments, timeline),
  };
}

async function seedCalendar(createCalendar: CreateCalendar) {
  const { calendarId } = await createCalendar.execute({
    tenantId,
    name: "Ventas",
    timezone: "America/Bogota",
  });
  return calendarId;
}

describe("CreateAppointment (SCR-004 — valida disponibilidad, crea timeline)", () => {
  it("crea el Appointment y su timeline.appointment.created", async () => {
    const { createCalendar, createAppointment, getDetail } = setup();
    const calendarId = await seedCalendar(createCalendar);

    const { appointmentId } = await createAppointment.execute({
      tenantId,
      calendarId,
      title: "Demo producto",
      timezone: "America/Bogota",
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    });

    const detail = await getDetail.execute(appointmentId);
    expect(detail?.status).toBe("scheduled");
    expect(detail?.timeline.map((e) => e.type)).toEqual(["appointment.created"]);
  });

  it("propaga a CustomerTimeline cuando hay customerId (Trigger 1 'Actualizar Customer')", async () => {
    const { createCalendar, createAppointment, customerTimeline } = setup();
    const calendarId = await seedCalendar(createCalendar);

    await createAppointment.execute({
      tenantId,
      calendarId,
      customerId: "cu1",
      title: "Demo producto",
      timezone: "America/Bogota",
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    });

    const entries = [...customerTimeline.store.values()];
    expect(entries.map((e) => e.type)).toEqual(["appointment.scheduled"]);
  });

  it("rechaza horarios solapados en el mismo Calendar (Time Conflict)", async () => {
    const { createCalendar, createAppointment } = setup();
    const calendarId = await seedCalendar(createCalendar);
    const slot = {
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    };

    await createAppointment.execute({
      tenantId,
      calendarId,
      title: "A",
      timezone: "America/Bogota",
      ...slot,
    });

    await expect(
      createAppointment.execute({
        tenantId,
        calendarId,
        title: "B (se solapa)",
        timezone: "America/Bogota",
        startsAt: new Date("2026-08-01T15:15:00.000Z"),
        endsAt: new Date("2026-08-01T15:45:00.000Z"),
      }),
    ).rejects.toThrow(DomainError);
  });
});

describe("SetAppointmentStatus / RescheduleAppointment / DeleteAppointment", () => {
  it("confirma, reprograma (validando conflicto) y elimina (soft delete)", async () => {
    const { createCalendar, createAppointment, setStatus, reschedule, deleteAppointment, getDetail } =
      setup();
    const calendarId = await seedCalendar(createCalendar);
    const { appointmentId } = await createAppointment.execute({
      tenantId,
      calendarId,
      title: "Demo",
      timezone: "America/Bogota",
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    });

    await setStatus.execute(appointmentId, "confirmed");
    expect((await getDetail.execute(appointmentId))?.status).toBe("confirmed");

    await reschedule.execute({
      appointmentId,
      startsAt: new Date("2026-08-02T15:00:00.000Z"),
      endsAt: new Date("2026-08-02T15:30:00.000Z"),
    });
    const rescheduled = await getDetail.execute(appointmentId);
    expect(rescheduled?.startsAt.toISOString()).toBe("2026-08-02T15:00:00.000Z");

    await deleteAppointment.execute(appointmentId);
    expect((await getDetail.execute(appointmentId))?.deleted).toBe(true);
  });

  it("reschedule no considera conflicto consigo mismo (excludeId)", async () => {
    const { createCalendar, createAppointment, reschedule } = setup();
    const calendarId = await seedCalendar(createCalendar);
    const { appointmentId } = await createAppointment.execute({
      tenantId,
      calendarId,
      title: "Demo",
      timezone: "America/Bogota",
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    });

    await expect(
      reschedule.execute({
        appointmentId,
        startsAt: new Date("2026-08-01T15:05:00.000Z"),
        endsAt: new Date("2026-08-01T15:35:00.000Z"),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("ListAppointments / ListCalendars", () => {
  it("lista calendarios y reuniones del Tenant", async () => {
    const { createCalendar, createAppointment, listCalendars, listAppointments } = setup();
    const calendarId = await seedCalendar(createCalendar);
    await createAppointment.execute({
      tenantId,
      calendarId,
      title: "Demo",
      timezone: "America/Bogota",
      startsAt: new Date("2026-08-01T15:00:00.000Z"),
      endsAt: new Date("2026-08-01T15:30:00.000Z"),
    });

    expect(await listCalendars.execute(tenantId)).toHaveLength(1);
    const result = await listAppointments.execute({ tenantId });
    expect(result.total).toBe(1);
  });
});
