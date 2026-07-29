import { Identity } from "@/domain";
import { ReportsRepository } from "../ports/reports-repository";

/** GetAppointmentMetrics — SCR-005 §7 GET /reports/appointments. */
export class GetAppointmentMetrics {
  constructor(private readonly reports: ReportsRepository) {}

  async execute(tenantId: string) {
    return {
      appointmentsByStatus: await this.reports.getAppointmentsByStatus(Identity.of(tenantId)),
    };
  }
}
