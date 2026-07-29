import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/PUT/DELETE /api/webhooks/:id — SCR-011 §6.1 (DELETE archiva). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const detail = await container.getWebhookDetail.execute(id);
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
    await container.updateWebhook.execute({ webhookId: id, ...body });
    return NextResponse.json({ success: true, message: "Webhook updated successfully." });
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
    await container.setWebhookStatus.execute(id, "archived");
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
