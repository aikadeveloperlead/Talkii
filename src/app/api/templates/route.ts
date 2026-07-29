import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/templates — SCR-006. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json({ items: await scope.container.listTemplates.execute(scope.tenantId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = await request.json();
    if (
      typeof body.name !== "string" ||
      typeof body.language !== "string" ||
      typeof body.category !== "string" ||
      typeof body.body !== "string"
    ) {
      return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
    }
    const result = await scope.container.createTemplate.execute({
      tenantId: scope.tenantId,
      name: body.name,
      language: body.language,
      category: body.category,
      components: {
        headerType: body.headerType,
        headerContent: body.headerContent,
        body: body.body,
        footer: body.footer,
        buttons: Array.isArray(body.buttons) ? body.buttons : [],
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
