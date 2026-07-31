import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";
import { updateLeadSchema } from "@/app/_lib/validation";

/** PATCH /api/customers/:id/lead — SCR-003 §7. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    const { status, score } = updateLeadSchema.parse(await request.json());
    await container.updateLead.execute({ customerId: id, status, score });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
