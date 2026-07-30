import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Identity } from "@/domain";
import { SupabaseReportsRepository } from "@/infrastructure";

/**
 * Fake genérico: cada `.from(table)` abre una cadena encadenable
 * (select/eq/is) que resuelve a `{ count, error: null }` — el valor depende
 * solo de la tabla, no de los filtros (suficiente para estas pruebas). `.rpc`
 * devuelve las filas configuradas para esa función.
 */
function fakeDb(options: {
  countsByTable?: Record<string, number>;
  rpcRows?: Record<string, { status: string; count: number }[]>;
  onFrom?: (table: string) => void;
  onRpc?: (fn: string, params: Record<string, unknown>) => void;
}): SupabaseClient {
  function chain(table: string) {
    const result = { count: options.countsByTable?.[table] ?? 0, error: null };
    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      then: (resolve: (v: typeof result) => void) => resolve(result),
    };
    return builder;
  }
  return {
    from: (table: string) => {
      options.onFrom?.(table);
      return chain(table);
    },
    rpc: async (fn: string, params: Record<string, unknown>) => {
      options.onRpc?.(fn, params);
      return { data: options.rpcRows?.[fn] ?? [], error: null };
    },
  } as unknown as SupabaseClient;
}

describe("SupabaseReportsRepository.getConversationSummary (item MEDIO #9)", () => {
  it("consulta solo conversations+sessions, no las 6 tablas de getDashboardKpis", async () => {
    const fromCalls: string[] = [];
    const db = fakeDb({
      countsByTable: { conversations: 12, sessions: 3 },
      onFrom: (table) => fromCalls.push(table),
    });
    const repo = new SupabaseReportsRepository(db);

    const summary = await repo.getConversationSummary(Identity.of("t1"));

    expect(summary).toEqual({ total: 12, activeSessions: 3 });
    expect(fromCalls.sort()).toEqual(["conversations", "sessions"]);
  });
});

describe("SupabaseReportsRepository.getLeadsByStatus (item MEDIO #10)", () => {
  it("agrega vía un único RPC en vez de N queries en paralelo", async () => {
    let rpcCalls = 0;
    const db = fakeDb({
      rpcRows: {
        count_leads_by_status: [
          { status: "new", count: 4 },
          { status: "won", count: 2 },
        ],
      },
      onRpc: () => {
        rpcCalls += 1;
      },
    });
    const repo = new SupabaseReportsRepository(db);

    const result = await repo.getLeadsByStatus(Identity.of("t1"));

    expect(rpcCalls).toBe(1);
    expect(result).toEqual({ new: 4, contacted: 0, qualified: 0, won: 2, lost: 0 });
  });
});

describe("SupabaseReportsRepository.getAppointmentsByStatus (item MEDIO #10)", () => {
  it("agrega vía un único RPC en vez de N queries en paralelo", async () => {
    let rpcCalls = 0;
    const db = fakeDb({
      rpcRows: {
        count_appointments_by_status: [{ status: "confirmed", count: 7 }],
      },
      onRpc: () => {
        rpcCalls += 1;
      },
    });
    const repo = new SupabaseReportsRepository(db);

    const result = await repo.getAppointmentsByStatus(Identity.of("t1"));

    expect(rpcCalls).toBe(1);
    expect(result).toEqual({ scheduled: 0, confirmed: 7, cancelled: 0, completed: 0 });
  });
});
