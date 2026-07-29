import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** PATCH /api/appointments/:id/reschedule — SCR-004 §7. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { startsAt, endsAt } = await request.json();
    if (typeof startsAt !== "string" || typeof endsAt !== "string") {
      return NextResponse.json({ error: "Invalid Appointment" }, { status: 400 });
    }
    await container.rescheduleAppointment.execute({
      appointmentId: id,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
