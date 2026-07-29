import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/conversations/:id/messages — SCR-002 §7 (Conversation Service). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    const messages = await container.listConversationMessages.execute(id);
    if (!messages) {
      return NextResponse.json({ error: "Conversation Not Found" }, { status: 404 });
    }
    return NextResponse.json({ messages });
  } catch (error) {
    return toErrorResponse(error);
  }
}
