import { Identity } from "@/domain";
import { ReportsRepository } from "../ports/reports-repository";

/** GetConversationMetrics — SCR-005 §7 GET /reports/conversations. */
export class GetConversationMetrics {
  constructor(private readonly reports: ReportsRepository) {}

  async execute(tenantId: string) {
    return this.reports.getConversationSummary(Identity.of(tenantId));
  }
}
