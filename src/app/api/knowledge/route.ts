import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/knowledge — SCR-009 §6.1. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json({
      items: await scope.container.listKnowledgeDocuments.execute(scope.tenantId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = await request.json();
    if (typeof body.title !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    const result = await scope.container.createKnowledgeDocument.execute({
      tenantId: scope.tenantId,
      title: body.title,
      categoryId: body.categoryId,
      content: body.content,
      sourceType: body.sourceType ?? "text",
      sourceFile: body.sourceFile,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
