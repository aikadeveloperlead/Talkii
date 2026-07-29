import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/calendars — SCR-004 §7. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const calendars = await scope.container.listCalendars.execute(scope.tenantId);
    return NextResponse.json({ items: calendars });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const body = await request.json();
    if (typeof body.name !== "string" || typeof body.timezone !== "string") {
      return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
    }
    const result = await scope.container.createCalendar.execute({
      tenantId: scope.tenantId,
      name: body.name,
      timezone: body.timezone,
      color: body.color,
      isDefault: body.isDefault,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
