import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * GET /api/reports/funnel — SCR-005 §7.
 *
 * Nombre potencialmente engañoso (item BAJO #18 de la auditoría): NO reporta
 * progreso de Customers/Conversations a través de los pasos (steps) de un
 * Funnel concreto — esa relación no existe todavía (requeriría que Scheduling/
 * CRM/Conversation dejaran domain events consumibles por Automation/Reporting,
 * ver item MEDIO #3, backlogueado explícitamente como feature nueva, no bug).
 * Es la MISMA fuente que /reports/customers (distribución de Leads por
 * status) — el único proxy de "etapa comercial" que existe hoy. Se mantiene
 * el nombre de ruta (no se renombra: es un contrato de API ya consumido/
 * documentado en SCR-005) y se documenta la limitación explícitamente aquí
 * en vez de solo en la memoria de sesión.
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
