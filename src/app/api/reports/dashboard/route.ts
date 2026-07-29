import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * GET /api/reports/dashboard — SCR-005 §7. Devuelve solo `summary` +
 * `lastUpdate`; `widgets`/`charts` personalizables quedan fuera de alcance
 * (requieren dashboard_view/dashboard_widget, no construidos en esta pasada).
 */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const summary = await scope.container.getDashboardKpis.execute(scope.tenantId);
    return NextResponse.json({ summary, lastUpdate: new Date().toISOString() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
