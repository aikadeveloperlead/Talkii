import { Identity } from "@/domain";
import { ReportsRepository } from "../ports/reports-repository";

/**
 * GetCustomerMetrics — SCR-005 §7 GET /reports/customers y GET /reports/funnel
 * (misma fuente: distribución de Leads por status es el único dato de "etapa
 * comercial" persistido — no existe todavía progreso de Funnel por Customer).
 */
export class GetCustomerMetrics {
  constructor(private readonly reports: ReportsRepository) {}

  async execute(tenantId: string) {
    return { leadsByStatus: await this.reports.getLeadsByStatus(Identity.of(tenantId)) };
  }
}
