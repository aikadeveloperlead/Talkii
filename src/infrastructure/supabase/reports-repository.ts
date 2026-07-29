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
          () => this.db.from("conversations").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
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
        count(
          () =>
            this.db
              .from("customers")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", tid)
              .is("archived_at", null),
          "customers.count",
        ),
        count(
          () =>
            this.db
              .from("appointments")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", tid)
              .is("deleted_at", null),
          "appointments.count",
        ),
        count(
          () =>
            this.db
              .from("leads")
              .select("*, customers!inner(tenant_id)", { count: "exact", head: true })
              .eq("customers.tenant_id", tid),
          "leads.count",
        ),
        count(
          () =>
            this.db
              .from("leads")
              .select("*, customers!inner(tenant_id)", { count: "exact", head: true })
              .eq("customers.tenant_id", tid)
              .eq("status", "won"),
          "leads.count",
        ),
      ]);

    return { conversationCount, activeSessionCount, customerCount, appointmentCount, leadCount, wonLeadCount };
  }

  async getLeadsByStatus(tenantId: Identity): Promise<Record<string, number>> {
    const tid = tenantId.toString();
    const entries = await Promise.all(
      LEAD_STATUSES.map(async (status) => {
        const n = await count(
          () =>
            this.db
              .from("leads")
              .select("*, customers!inner(tenant_id)", { count: "exact", head: true })
              .eq("customers.tenant_id", tid)
              .eq("status", status),
          "leads.count",
        );
        return [status, n] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async getAppointmentsByStatus(tenantId: Identity): Promise<Record<string, number>> {
    const tid = tenantId.toString();
    const entries = await Promise.all(
      APPOINTMENT_STATUSES.map(async (status) => {
        const n = await count(
          () =>
            this.db
              .from("appointments")
              .select("*", { count: "exact", head: true })
              .eq("tenant_id", tid)
              .is("deleted_at", null)
              .eq("status", status),
          "appointments.count",
        );
        return [status, n] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async getConversationSummary(
    tenantId: Identity,
  ): Promise<{ total: number; activeSessions: number }> {
    const kpis = await this.getDashboardKpis(tenantId);
    return { total: kpis.conversationCount, activeSessions: kpis.activeSessionCount };
  }
}
