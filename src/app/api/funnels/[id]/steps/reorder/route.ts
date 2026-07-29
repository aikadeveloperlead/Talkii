import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** PATCH /api/funnels/:id/steps/reorder — SCR-010 §6.2 (adaptado, ver nota en steps/route.ts). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { stepKeys } = await request.json();
    if (!Array.isArray(stepKeys)) {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    await container.reorderFunnelSteps.execute(id, stepKeys);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
