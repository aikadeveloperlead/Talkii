import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/customers/:id/timeline — SCR-003 §7. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    const detail = await container.getCustomerDetail.execute(id);
    if (!detail) {
      return NextResponse.json({ error: "Customer Not Found" }, { status: 404 });
    }
    return NextResponse.json({ timeline: detail.timeline });
  } catch (error) {
    return toErrorResponse(error);
  }
}
