import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/webhooks — SCR-011 §6.1. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json({ items: await scope.container.listWebhooks.execute(scope.tenantId) });
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
      typeof body.url !== "string" ||
      !Array.isArray(body.events)
    ) {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    const result = await scope.container.createWebhook.execute({
      tenantId: scope.tenantId,
      name: body.name,
      url: body.url,
      secret: body.secret,
      events: body.events,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
