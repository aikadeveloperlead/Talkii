import type { SupabaseClient } from "@supabase/supabase-js";
import { Identity } from "@/domain";
import type { DashboardKpis, ReportsRepository } from "@/application/ports";

const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "cancelled", "completed"] as const;

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }>;

async function count(build: () => CountQuery, op: string): Promise<number> {
  const { count: n, error } = await build();
  if (error) fail(op, error);
  return n ?? 0;
}

/**
 * SupabaseReportsRepository — read-model de agregación (SCR-005): consultas
 * de solo lectura sobre tablas ya existentes de otros bounded contexts. Sin
 * `GROUP BY` nativo en PostgREST, se resuelve con conteos en paralelo por
 * cada valor de status (escala razonable al tamaño de un Tenant en MVP).
 */
export class SupabaseReportsRepository implements ReportsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getDashboardKpis(tenantId: Identity): Promise<DashboardKpis> {
    const tid = tenantId.toString();

    const [conversationCount, activeSessionCount, customerCount, appointmentCount, leadCount, wonLeadCount] =
      await Promise.all([
        count(
          () => this.db.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
          "conversations.count",
        ),
        count(
          () =>
            this.db
              .from("sessions")
              .select("id, conversations!inner(tenant_id)", { count: "exact", head: true })
              .eq("status", "active")
              .eq("conversations.tenant_id", tid),
          "sessions.count",
        ),
        count(
          () =>
            this.db
              .from("customers")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tid)
              .is("archived_at", null),
          "customers.count",
        ),
        count(
          () =>
            this.db
              .from("appointments")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tid)
              .is("deleted_at", null),
          "appointments.count",
        ),
        count(
          () =>
            this.db
              .from("leads")
              .select("id, customers!inner(tenant_id)", { count: "exact", head: true })
              .eq("customers.tenant_id", tid),
          "leads.count",
        ),
        count(
          () =>
            this.db
              .from("leads")
              .select("id, customers!inner(tenant_id)", { count: "exact", head: true })
              .eq("customers.tenant_id", tid)
              .eq("status", "won"),
          "leads.count",
        ),
      ]);

    return { conversationCount, activeSessionCount, customerCount, appointmentCount, leadCount, wonLeadCount };
  }

  async getLeadsByStatus(tenantId: Identity): Promise<Record<string, number>> {
    return this.countByStatusRpc(
      "count_leads_by_status",
      tenantId,
      LEAD_STATUSES,
    );
  }

  async getAppointmentsByStatus(tenantId: Identity): Promise<Record<string, number>> {
    return this.countByStatusRpc(
      "count_appointments_by_status",
      tenantId,
      APPOINTMENT_STATUSES,
    );
  }

  /**
   * Items MEDIO #9/#10 de la auditoría: antes N queries en paralelo (una por
   * status) porque PostgREST no expone GROUP BY nativo — ahora 1 sola llamada
   * a un RPC que agrega en el servidor (migración 0023). Se pre-llenan todos
   * los statuses del enum en 0 para conservar la forma del resultado (el RPC
   * solo devuelve filas para statuses con al menos 1 fila).
   */
  private async countByStatusRpc(
    fn: "count_leads_by_status" | "count_appointments_by_status",
    tenantId: Identity,
    allStatuses: readonly string[],
  ): Promise<Record<string, number>> {
    const { data, error } = await this.db.rpc(fn, { p_tenant_id: tenantId.toString() });
    if (error) fail(fn, error);

    const result = Object.fromEntries(allStatuses.map((s) => [s, 0]));
    for (const row of (data ?? []) as { status: string; count: number }[]) {
      result[row.status] = row.count;
    }
    return result;
  }

  /**
   * Item MEDIO #9 de la auditoría: antes reutilizaba getDashboardKpis (6
   * queries) para leer solo 2 de sus 6 campos — ahora consulta directo lo que
   * necesita.
   */
  async getConversationSummary(
    tenantId: Identity,
  ): Promise<{ total: number; activeSessions: number }> {
    const tid = tenantId.toString();
    const [total, activeSessions] = await Promise.all([
      count(
        () => this.db.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
        "conversations.count",
      ),
      count(
        () =>
          this.db
            .from("sessions")
            .select("*, conversations!inner(tenant_id)", { count: "exact", head: true })
            .eq("status", "active")
            .eq("conversations.tenant_id", tid),
        "sessions.count",
      ),
    ]);
    return { total, activeSessions };
  }
}
