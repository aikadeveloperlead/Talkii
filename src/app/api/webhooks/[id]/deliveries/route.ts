import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/webhooks/:id/deliveries — SCR-011 §4.3 "Consultar Historial" (WH-06). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    return NextResponse.json({ items: await container.listWebhookDeliveries.execute(id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
