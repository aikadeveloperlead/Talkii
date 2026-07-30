import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";
import { updateFunnelStepSchema } from "@/app/_lib/validation";

/** PUT/DELETE /api/funnels/:id/steps/:stepKey — SCR-010 §6.2 (adaptado, ver nota en steps/route.ts). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; stepKey: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id, stepKey } = await params;
    const body = updateFunnelStepSchema.parse(await request.json());
    await container.updateFunnelStep.execute(id, stepKey, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stepKey: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id, stepKey } = await params;
    await container.deleteFunnelStep.execute(id, stepKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
