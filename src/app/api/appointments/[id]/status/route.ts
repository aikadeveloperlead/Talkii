import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** PATCH /api/appointments/:id/status — SCR-004 §7. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const { status } = await request.json();
    if (!["scheduled", "confirmed", "cancelled", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid Appointment" }, { status: 400 });
    }
    await container.setAppointmentStatus.execute(id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
