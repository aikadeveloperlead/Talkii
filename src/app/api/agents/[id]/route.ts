import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";
import { updateAgentSchema } from "@/app/_lib/validation";

/** GET/PUT/DELETE /api/agents/:id — SCR-008 §6.1 (DELETE archiva, BK-04 nunca elimina físicamente). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const detail = await container.getAgentDetail.execute(id);
    if (!detail) return NextResponse.json({ success: false, message: "Agent not found." }, { status: 404 });
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
    const body = updateAgentSchema.parse(await request.json());
    await container.updateAgent.execute({ agentId: id, ...body });
    return NextResponse.json({ success: true, message: "Agent updated successfully." });
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
    await container.setAgentStatus.execute(id, "archived");
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
