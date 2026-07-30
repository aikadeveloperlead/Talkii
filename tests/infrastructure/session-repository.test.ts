import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError, Identity, Session } from "@/domain";
import { SupabaseSessionRepository } from "@/infrastructure/supabase/repositories";

/**
 * Item 10 de la auditoría, sub-item 5/5: "condición de carrera puede
 * duplicar Sessions activas". La migración 0015_sessions_one_active.sql
 * agrega el índice único parcial a nivel de Postgres (verificado
 * empíricamente contra el proyecto remoto vía execute_sql — sin framework de
 * test que introspeccione constraints en vivo en este repo, mismo patrón que
 * scheduling-repositories.test.ts para el EXCLUDE de citas). Este test cubre
 * la parte SÍ testeable con Vitest: que el repositorio traduzca la violación
 * (código Postgres 23505, unique_violation) a un DomainError — 409 vía
 * toErrorResponse — en vez de un Error genérico (500).
 */
function fakeDb(error: { code: string; message: string } | null): SupabaseClient {
  return {
    from: () => ({
      upsert: async () => ({ error }),
    }),
  } as unknown as SupabaseClient;
}

function buildSession() {
  return Session.open(Identity.of("s1"), Identity.of("c1"), new Date("2026-07-15T00:00:00.000Z"));
}

describe("SupabaseSessionRepository.save — traduce unique_violation a DomainError", () => {
  it("lanza DomainError cuando Postgres rechaza por el índice único de Session activa (código 23505)", async () => {
    const repo = new SupabaseSessionRepository(
      fakeDb({ code: "23505", message: "duplicate key value violates unique constraint" }),
    );

    await expect(repo.save(buildSession())).rejects.toThrow(DomainError);
    await expect(repo.save(buildSession())).rejects.toThrow(/Session activa/i);
  });

  it("otros errores de Postgres siguen propagando como Error genérico (sin cambiar su comportamiento)", async () => {
    const repo = new SupabaseSessionRepository(
      fakeDb({ code: "23514", message: "check constraint violated" }),
    );

    await expect(repo.save(buildSession())).rejects.toThrow("Supabase sessions.upsert");
  });

  it("no lanza cuando no hay error", async () => {
    const repo = new SupabaseSessionRepository(fakeDb(null));
    await expect(repo.save(buildSession())).resolves.toBeUndefined();
  });
});
