import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** POST/DELETE /api/agents/:id/funnel — SCR-010 §6.4 (FN-02). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { funnelId } = await request.json();
    if (typeof funnelId !== "string") {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    await container.assignFunnelToAgent.execute(id, funnelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    await container.unassignFunnelFromAgent.execute(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
