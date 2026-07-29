import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * GET /api/reports/funnel — SCR-005 §7. Misma fuente que /reports/customers
 * (distribución de Leads por status): no existe todavía progreso de Funnel
 * por Customer/Conversation (ver limitación documentada en SCR-002/SCR-003).
 */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json(await scope.container.getCustomerMetrics.execute(scope.tenantId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
