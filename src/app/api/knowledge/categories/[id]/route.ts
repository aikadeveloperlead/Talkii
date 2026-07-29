import { NextResponse } from "next/server";
import { requireContainer, unauthorized } from "@/app/_lib/route-container";

/** DELETE /api/knowledge/categories/:id — SCR-009 §6.2. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  const { id } = await params;
  await container.deleteCategory.execute(id);
  return NextResponse.json({ success: true });
}
