import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/conversations/:id — SCR-002 §7 (Conversation Service). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    const detail = await container.getConversationDetail.execute(id);
    if (!detail) {
      return NextResponse.json({ error: "Conversation Not Found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}
