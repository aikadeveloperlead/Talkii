import { Identity } from "@/domain";
import { ReportsRepository } from "../ports/reports-repository";

/** GetDashboardKpis — SCR-005 §7 GET /reports/kpis (y el "summary" de GET /reports/dashboard). */
export class GetDashboardKpis {
  constructor(private readonly reports: ReportsRepository) {}

  async execute(tenantId: string) {
    const kpis = await this.reports.getDashboardKpis(Identity.of(tenantId));
    const conversionRate = kpis.leadCount > 0 ? kpis.wonLeadCount / kpis.leadCount : 0;
    return { ...kpis, conversionRate };
  }
}
