import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";
import { updatePreferencesSchema } from "@/app/_lib/validation";

/** GET/PUT /api/settings/preferences — SCR-012 §6.5. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const data = await scope.container.getPreferences.execute(scope.tenantId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = updatePreferencesSchema.parse(await request.json());
    await scope.container.updatePreferences.execute({ tenantId: scope.tenantId, ...body });
    return NextResponse.json({ success: true, message: "Settings updated successfully." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
