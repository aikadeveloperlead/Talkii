import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * POST /api/conversation/intervention — SCR-002 §7 (Estado 8, "Desactivar
 * Runtime"): el operador toma el control; HandleInboundMessage deja de
 * decidir automáticamente sobre esta Conversation.
 */
export async function POST(request: Request) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { conversationId } = await request.json();
    if (typeof conversationId !== "string" || !conversationId) {
      return NextResponse.json({ error: "Invalid Conversation" }, { status: 400 });
    }
    await container.setOperatorControl.execute({ conversationId, enabled: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
