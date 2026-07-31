import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/webhooks/:id/deliveries — SCR-011 §4.3 "Consultar Historial" (WH-06). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    // `limit` acotado en el caso de uso (hallazgo HIGH: antes se devolvían
    // TODAS las entregas históricas del webhook).
    const limit = Number(new URL(request.url).searchParams.get("limit")) || undefined;
    return NextResponse.json({ items: await container.listWebhookDeliveries.execute(id, limit) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
