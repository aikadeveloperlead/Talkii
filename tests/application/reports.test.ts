import { describe, expect, it } from "vitest";
import {
  GetAppointmentMetrics,
  GetConversationMetrics,
  GetCustomerMetrics,
  GetDashboardKpis,
} from "@/application/use-cases";
import { FakeReports } from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

describe("GetDashboardKpis (SCR-005 §7 GET /reports/kpis)", () => {
  it("calcula conversionRate = wonLeadCount / leadCount", async () => {
    const reports = new FakeReports({
      conversationCount: 10,
      activeSessionCount: 3,
      customerCount: 5,
      appointmentCount: 2,
      leadCount: 4,
      wonLeadCount: 1,
    });
    const useCase = new GetDashboardKpis(reports);

    const result = await useCase.execute(tenantId);

    expect(result.conversionRate).toBe(0.25);
    expect(result.customerCount).toBe(5);
  });

  it("conversionRate es 0 si no hay Leads (evita división por cero)", async () => {
    const useCase = new GetDashboardKpis(new FakeReports());
    const result = await useCase.execute(tenantId);
    expect(result.conversionRate).toBe(0);
  });
});

describe("GetCustomerMetrics / GetAppointmentMetrics / GetConversationMetrics", () => {
  it("delegan al ReportsRepository sin transformar los datos", async () => {
    const reports = new FakeReports(
      undefined,
      { new: 3, won: 1 },
      { scheduled: 2, completed: 1 },
      { total: 7, activeSessions: 2 },
    );

    expect(await new GetCustomerMetrics(reports).execute(tenantId)).toEqual({
      leadsByStatus: { new: 3, won: 1 },
    });
    expect(await new GetAppointmentMetrics(reports).execute(tenantId)).toEqual({
      appointmentsByStatus: { scheduled: 2, completed: 1 },
    });
    expect(await new GetConversationMetrics(reports).execute(tenantId)).toEqual({
      total: 7,
      activeSessions: 2,
    });
  });
});
