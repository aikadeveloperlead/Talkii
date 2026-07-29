import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** PATCH /api/webhooks/:id/status — SCR-011 §4.3 activar/desactivar. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { status } = await request.json();
    if (!["active", "disabled", "archived"].includes(status)) {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    await container.setWebhookStatus.execute(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
