import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/reports/customers — SCR-005 §7. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json(await scope.container.getCustomerMetrics.execute(scope.tenantId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
