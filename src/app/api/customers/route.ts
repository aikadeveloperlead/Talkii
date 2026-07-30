import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/customers — SCR-003 §7 (paginado + filtros). */
export async function GET(request: NextRequest) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();

  try {
    const params = request.nextUrl.searchParams;
    const result = await scope.container.listCustomers.execute({
      tenantId: scope.tenantId,
      query: params.get("search") ?? undefined,
      tags: params.get("tags")?.split(",").filter(Boolean),
      cursor: params.get("cursor") ?? undefined,
      limit: Number(params.get("limit")) || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/customers — SCR-003 §7 (CreateCustomer). */
export async function POST(request: Request) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();

  try {
    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
    }
    const [firstName, ...rest] = body.name.trim().split(/\s+/);
    const result = await scope.container.createCustomer.execute({
      tenantId: scope.tenantId,
      firstName,
      lastName: rest.length ? rest.join(" ") : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
