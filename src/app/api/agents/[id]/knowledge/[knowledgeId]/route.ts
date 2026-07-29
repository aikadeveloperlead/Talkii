import { NextResponse } from "next/server";
import { requireContainer, unauthorized } from "@/app/_lib/route-container";

/** DELETE /api/agents/:id/knowledge/:knowledgeId — SCR-009 §6.5. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; knowledgeId: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  const { id, knowledgeId } = await params;
  await container.unlinkAgentKnowledge.execute(id, knowledgeId);
  return NextResponse.json({ success: true });
}
