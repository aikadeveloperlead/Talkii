import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Identity } from "@/domain";
import { SupabaseCustomerRepository } from "@/infrastructure/supabase/crm-repositories";

/**
 * Hallazgo MEDIO de la auditoría: "Inyección de filtro PostgREST en búsqueda
 * de clientes" — `filters.query` se interpolaba sin escapar en un `.or()`,
 * permitiendo inyectar predicados extra sobre `customers` (p. ej. una coma o
 * un paréntesis en el término de búsqueda agrega una condición fuera de las
 * 4 columnas intencionadas).
 *
 * Fake de query builder encadenable: cada método registra sus argumentos y
 * devuelve `this`, terminando en `range()` que resuelve el resultado —
 * permite inspeccionar el string exacto que llega a `.or()` sin una DB real.
 */
function fakeQueryBuilder(result: { data: unknown[]; error: null; count: number }) {
  const calls: Record<string, unknown[][]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
      return builder;
    };
  const builder = {
    select: record("select"),
    eq: record("eq"),
    is: record("is"),
    or: record("or"),
    contains: record("contains"),
    order: record("order"),
    range: async (...args: unknown[]) => {
      (calls.range ??= []).push(args);
      return result;
    },
  };
  return { builder, calls };
}

describe("SupabaseCustomerRepository.search — sanitiza el término de búsqueda antes de .or()", () => {
  it("quita caracteres estructurales de PostgREST (, ( )) del término de búsqueda", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null, count: 0 });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    await repo.search(Identity.of("t1"), { query: "smith,or(tags.cs.{admin})" }, 1, 10);

    const orArg = calls.or[0][0] as string;
    // Solo deben sobrevivir las 3 comas legítimas que separan las 4 condiciones
    // (first_name/last_name/phone/email) — ninguna proveniente del input.
    expect(orArg.split(",")).toHaveLength(4);
    expect(orArg).not.toContain("(tags.cs");
  });

  it("una búsqueda normal sigue funcionando igual (sin falsos positivos)", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null, count: 0 });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    await repo.search(Identity.of("t1"), { query: "Ana García" }, 1, 10);

    const orArg = calls.or[0][0] as string;
    expect(orArg).toContain("Ana García");
    expect(orArg.split(",")).toHaveLength(4);
  });
});
