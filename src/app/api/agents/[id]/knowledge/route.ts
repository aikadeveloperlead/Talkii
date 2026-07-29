import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** POST /api/agents/:id/knowledge — SCR-009 §6.5 / SCR-008 §6.3. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { knowledgeId } = await request.json();
    if (typeof knowledgeId !== "string") {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    await container.linkAgentKnowledge.execute(id, knowledgeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
