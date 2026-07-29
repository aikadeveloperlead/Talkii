import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * POST /api/messages — SCR-002 §7: un operador humano compone y envía un
 * mensaje directamente sobre la Conversation (SendOperatorMessage).
 */
export async function POST(request: Request) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { conversationId, text } = await request.json();
    if (
      typeof conversationId !== "string" ||
      !conversationId ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return NextResponse.json({ error: "Invalid Conversation" }, { status: 400 });
    }
    const result = await container.sendOperatorMessage.execute({ conversationId, text });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
