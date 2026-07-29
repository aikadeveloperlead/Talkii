import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/PUT/DELETE /api/funnels/:id — SCR-010 §6.1 (DELETE archiva). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const detail = await container.getFunnelDetail.execute(id);
    if (!detail) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const body = await request.json();
    await container.updateFunnel.execute({ funnelId: id, ...body });
    return NextResponse.json({ success: true, message: "Funnel updated successfully." });
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
    await container.setFunnelStatus.execute(id, "archived");
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
