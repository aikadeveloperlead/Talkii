import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Customer, DomainError, Identity } from "@/domain";
import { SupabaseCustomerRepository } from "@/infrastructure/supabase/crm-repositories";

function buildRow(id: string, createdAt: string) {
  return {
    id,
    tenant_id: "t1",
    first_name: "Cliente",
    last_name: null,
    phone: "3000000000",
    email: null,
    company: null,
    position: null,
    city: null,
    country: null,
    tags: [],
    archived_at: null,
    created_at: createdAt,
  };
}

/**
 * Fake de query builder encadenable: cada método registra sus argumentos y
 * devuelve `this`, terminando en `limit()` que resuelve el resultado —
 * permite inspeccionar el string exacto que llega a `.or()` sin una DB real.
 * Item MEDIO #12 de la auditoría: `range()`/OFFSET reemplazado por
 * `limit()` + keyset cursor (dos `.order()`, sin `.range()`).
 */
function fakeQueryBuilder(result: { data: unknown[]; error: null }) {
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
    limit: async (...args: unknown[]) => {
      (calls.limit ??= []).push(args);
      return result;
    },
  };
  return { builder, calls };
}

describe("SupabaseCustomerRepository.search — sanitiza el término de búsqueda antes de .or() (item MEDIO: inyección PostgREST)", () => {
  it("quita caracteres estructurales de PostgREST (, ( )) del término de búsqueda", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    await repo.search(Identity.of("t1"), { query: "smith,or(tags.cs.{admin})" }, null, 10);

    const orArg = calls.or[0][0] as string;
    expect(orArg.split(",")).toHaveLength(4);
    expect(orArg).not.toContain("(tags.cs");
  });

  it("una búsqueda normal sigue funcionando igual (sin falsos positivos)", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    await repo.search(Identity.of("t1"), { query: "Ana García" }, null, 10);

    const orArg = calls.or[0][0] as string;
    expect(orArg).toContain("Ana García");
    expect(orArg.split(",")).toHaveLength(4);
  });
});

describe("SupabaseCustomerRepository.search — paginación por cursor (item MEDIO #12)", () => {
  it("sin cursor: no agrega predicado de continuación, usa limit(limit+1)", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    await repo.search(Identity.of("t1"), {}, null, 10);

    expect(calls.or ?? []).toHaveLength(0);
    expect(calls.limit[0][0]).toBe(11);
  });

  it("con cursor: agrega el predicado keyset (created_at, id) decodificado", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    const id = "3f7c1b2e-1111-4111-8111-aaaaaaaaaaaa";
    const cursor = Buffer.from(`2026-01-01T00:00:00.000Z|${id}`, "utf8").toString("base64url");
    await repo.search(Identity.of("t1"), {}, cursor, 10);

    const orArg = calls.or[0][0] as string;
    expect(orArg).toContain("created_at.lt.2026-01-01T00:00:00.000Z");
    expect(orArg).toContain(`and(created_at.eq.2026-01-01T00:00:00.000Z,id.lt.${id})`);
  });

  it("devuelve nextCursor cuando hay más filas que el límite, recortando a `limit`", async () => {
    const rows = [
      buildRow("c3", "2026-01-03T00:00:00.000Z"),
      buildRow("c2", "2026-01-02T00:00:00.000Z"),
      buildRow("c1", "2026-01-01T00:00:00.000Z"), // fila extra (limit+1), se recorta
    ];
    const { builder } = fakeQueryBuilder({ data: rows, error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    const result = await repo.search(Identity.of("t1"), {}, null, 2);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((c) => c.id.toString())).toEqual(["c3", "c2"]);
    expect(result.nextCursor).not.toBeNull();
    const decoded = Buffer.from(result.nextCursor as string, "base64url").toString("utf8");
    expect(decoded).toBe("2026-01-02T00:00:00.000Z|c2");
  });

  it("ignora un cursor manipulado que intenta inyectar predicados PostgREST (hallazgo MEDIUM)", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    // `createdAt` manipulado con una coma + predicado extra sobre otra columna.
    const malicious = Buffer.from(
      "2020-01-01,email.ilike.*a*|3f7c1b2e-1111-4111-8111-aaaaaaaaaaaa",
      "utf8",
    ).toString("base64url");
    await repo.search(Identity.of("t1"), {}, malicious, 10);

    // El cursor se descarta por completo: no se agrega ningún `.or()`.
    expect(calls.or ?? []).toHaveLength(0);
  });

  it("ignora un cursor cuyo id no es un UUID", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    const bad = Buffer.from("2026-01-01T00:00:00.000Z|not-a-uuid", "utf8").toString("base64url");
    await repo.search(Identity.of("t1"), {}, bad, 10);

    expect(calls.or ?? []).toHaveLength(0);
  });

  it("sigue aceptando un cursor legítimo emitido por el propio repositorio", async () => {
    const { builder, calls } = fakeQueryBuilder({ data: [], error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    const good = Buffer.from(
      "2026-01-01T00:00:00.000Z|3f7c1b2e-1111-4111-8111-aaaaaaaaaaaa",
      "utf8",
    ).toString("base64url");
    await repo.search(Identity.of("t1"), {}, good, 10);

    expect(calls.or[0][0]).toContain("created_at.lt.2026-01-01T00:00:00.000Z");
  });

  it("nextCursor es null cuando las filas devueltas no superan el límite", async () => {
    const rows = [buildRow("c1", "2026-01-01T00:00:00.000Z")];
    const { builder } = fakeQueryBuilder({ data: rows, error: null });
    const db = { from: () => builder } as unknown as SupabaseClient;
    const repo = new SupabaseCustomerRepository(db);

    const result = await repo.search(Identity.of("t1"), {}, null, 10);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

describe("SupabaseCustomerRepository.save — traduce unique_violation a DomainError (hallazgo MEDIUM)", () => {
  function fakeUpsertDb(error: { code: string; message: string } | null): SupabaseClient {
    return {
      from: () => ({ upsert: async () => ({ error }) }),
    } as unknown as SupabaseClient;
  }

  function buildCustomer() {
    return Customer.create(Identity.of("3f7c1b2e-1111-4111-8111-aaaaaaaaaaaa"), {
      tenantId: Identity.of("t1"),
      firstName: "Ana",
      phone: "3000000000",
      tags: [],
    });
  }

  it("lanza DomainError (→409) cuando se pierde la carrera de teléfono único", async () => {
    const repo = new SupabaseCustomerRepository(
      fakeUpsertDb({ code: "23505", message: "duplicate key value violates unique constraint" }),
    );
    await expect(repo.save(buildCustomer())).rejects.toThrow(DomainError);
  });

  it("otros errores de Postgres siguen propagando como Error genérico (→500)", async () => {
    const repo = new SupabaseCustomerRepository(
      fakeUpsertDb({ code: "22P02", message: "invalid input syntax" }),
    );
    await expect(repo.save(buildCustomer())).rejects.toThrow("Supabase customers.upsert");
  });

  it("no lanza cuando no hay error", async () => {
    const repo = new SupabaseCustomerRepository(fakeUpsertDb(null));
    await expect(repo.save(buildCustomer())).resolves.toBeUndefined();
  });
});
