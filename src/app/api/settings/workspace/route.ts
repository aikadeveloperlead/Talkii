import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/PUT /api/settings/workspace — SCR-012 §6.1. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const data = await scope.container.getWorkspace.execute(scope.tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = await request.json();
    await scope.container.updateWorkspace.execute({ tenantId: scope.tenantId, ...body });
    return NextResponse.json({ success: true, message: "Settings updated successfully." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
