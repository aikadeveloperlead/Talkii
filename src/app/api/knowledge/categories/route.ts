import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/knowledge/categories — SCR-009 §6.2. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json({ items: await scope.container.listCategories.execute(scope.tenantId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = await request.json();
    if (typeof body.name !== "string") {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    const result = await scope.container.createCategory.execute({
      tenantId: scope.tenantId,
      name: body.name,
      color: body.color,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
