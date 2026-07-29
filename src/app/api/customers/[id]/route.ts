import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/customers/:id — SCR-003 §7. */
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
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PUT /api/customers/:id — SCR-003 §7 (actualiza información básica). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    await container.updateCustomer.execute({ customerId: id, ...body });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/customers/:id — SCR-003 §7 (Soft Delete, nunca Hard Delete). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();

  try {
    const { id } = await params;
    await container.archiveCustomer.execute(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
