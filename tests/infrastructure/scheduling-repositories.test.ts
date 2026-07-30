import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Appointment, DomainError, Identity } from "@/domain";
import { SupabaseAppointmentRepository } from "@/infrastructure/supabase/scheduling-repositories";

/**
 * Item 10 de la auditoría, sub-item 4/5: "sin EXCLUDE constraint contra
 * citas duplicadas". La migración 0013_appointments_no_overlap.sql agrega
 * el EXCLUDE a nivel de Postgres (verificado empíricamente contra el
 * proyecto remoto vía execute_sql — sin framework de test que introspeccione
 * constraints de Postgres en vivo en este repo). Este test cubre la parte SÍ
 * testeable con Vitest: que el repositorio traduzca la violación (código
 * Postgres 23P01, exclusion_violation) a un DomainError — 409 vía
 * toErrorResponse — en vez de un Error genérico (500).
 */
function fakeDb(error: { code: string; message: string } | null): SupabaseClient {
  return {
    from: () => ({
      upsert: async () => ({ error }),
    }),
  } as unknown as SupabaseClient;
}

function buildAppointment() {
  return Appointment.create(Identity.of("appt-1"), {
    tenantId: Identity.of("t1"),
    calendarId: Identity.of("cal-1"),
    title: "Demo",
    status: "scheduled",
    timezone: "UTC",
    startsAt: new Date("2026-08-01T10:00:00.000Z"),
    endsAt: new Date("2026-08-01T11:00:00.000Z"),
  });
}

describe("SupabaseAppointmentRepository.save — traduce exclusion_violation a DomainError", () => {
  it("lanza DomainError cuando Postgres rechaza por el EXCLUDE de solape (código 23P01)", async () => {
    const repo = new SupabaseAppointmentRepository(
      fakeDb({ code: "23P01", message: "conflicting key value violates exclusion constraint" }),
    );

    await expect(repo.save(buildAppointment())).rejects.toThrow(DomainError);
    await expect(repo.save(buildAppointment())).rejects.toThrow(/solapa/i);
  });

  it("otros errores de Postgres siguen propagando como Error genérico (sin cambiar su comportamiento)", async () => {
    const repo = new SupabaseAppointmentRepository(
      fakeDb({ code: "23505", message: "duplicate key" }),
    );

    await expect(repo.save(buildAppointment())).rejects.toThrow("Supabase appointments.upsert");
  });

  it("no lanza cuando no hay error", async () => {
    const repo = new SupabaseAppointmentRepository(fakeDb(null));
    await expect(repo.save(buildAppointment())).resolves.toBeUndefined();
  });
});
