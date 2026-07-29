import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/PUT /api/settings/company — SCR-012 §6.2. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const data = await scope.container.getCompany.execute(scope.tenantId);
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
    if (typeof body.businessName !== "string") {
      return NextResponse.json({ success: false, message: "Settings validation failed." }, { status: 422 });
    }
    await scope.container.updateCompany.execute({ tenantId: scope.tenantId, ...body });
    return NextResponse.json({ success: true, message: "Settings updated successfully." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
