import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET /api/customers/search — SCR-003 §7 (phone/email/name). */
export async function GET(request: NextRequest) {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();

  try {
    const params = request.nextUrl.searchParams;
    const query = params.get("phone") ?? params.get("email") ?? params.get("name") ?? "";
    const result = await scope.container.listCustomers.execute({
      tenantId: scope.tenantId,
      query,
      limit: 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
