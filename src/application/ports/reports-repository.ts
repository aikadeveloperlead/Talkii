import { Identity } from "@/domain";

/**
 * ReportsRepository — puerto de solo lectura (SCR-005 §7: "Ninguna API
 * modifica entidades del negocio. Todas las APIs son de lectura, agregación
 * o exportación"). No introduce persistencia nueva (AA-01): agrega sobre
 * customers/leads/appointments/conversations/sessions ya existentes.
 * Read-model dedicado (CQRS del lado de lectura) porque estas consultas
 * cruzan varios bounded contexts y no pertenecen a un único repositorio.
 */
export interface DashboardKpis {
  conversationCount: number;
  activeSessionCount: number;
  customerCount: number;
  appointmentCount: number;
  leadCount: number;
  wonLeadCount: number;
}

export interface ReportsRepository {
  getDashboardKpis(tenantId: Identity): Promise<DashboardKpis>;
  /** Conteo de Leads agrupados por status (mejor proxy disponible de "Funnel" — no existe todavía tracking de etapa por Customer). */
  getLeadsByStatus(tenantId: Identity): Promise<Record<string, number>>;
  getAppointmentsByStatus(tenantId: Identity): Promise<Record<string, number>>;
  getConversationSummary(
    tenantId: Identity,
  ): Promise<{ total: number; activeSessions: number }>;
}
