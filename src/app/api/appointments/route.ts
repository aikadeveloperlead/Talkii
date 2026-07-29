import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/appointments — SCR-004 §7. */
export async function GET(request: NextRequest) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    const params = request.nextUrl.searchParams;
    const result = await scope.container.listAppointments.execute({
      tenantId: scope.tenantId,
      calendarId: params.get("calendar") ?? undefined,
      customerId: params.get("customer") ?? undefined,
      status: params.get("status") ?? undefined,
      page: Number(params.get("page")) || undefined,
      limit: Number(params.get("limit")) || undefined,
    });
    return NextResponse.json(result);
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
      typeof body.calendarId !== "string" ||
      typeof body.title !== "string" ||
      typeof body.startsAt !== "string" ||
      typeof body.endsAt !== "string"
    ) {
      return NextResponse.json({ error: "Invalid Appointment" }, { status: 400 });
    }
    const result = await scope.container.createAppointment.execute({
      tenantId: scope.tenantId,
      calendarId: body.calendarId,
      customerId: body.customerId,
      conversationId: body.conversationId,
      title: body.title,
      description: body.description,
      timezone: body.timezone ?? "UTC",
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
