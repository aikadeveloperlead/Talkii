import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/**
 * POST /api/funnels/:id/steps — SCR-010 §6.2.
 * Nota: los pasos son un Objeto de Valor embebido en Funnel (JSONB, igual
 * que Agent.policies), no filas con id propio — por eso las rutas de edición/
 * borrado/reorden van anidadas bajo el Funnel (`.../steps/:stepKey`) en vez
 * del `/steps/{id}` plano del spec, que asume una tabla separada.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.name !== "string" || typeof body.stepKey !== "string") {
      return NextResponse.json({ success: false, message: "Validation error." }, { status: 422 });
    }
    await container.addFunnelStep.execute(id, {
      name: body.name,
      objective: body.objective ?? "",
      transitionCriteria: body.transitionCriteria ?? "",
      stepKey: body.stepKey,
      order: body.order,
      nextStep: body.nextStep,
      status: body.status ?? "active",
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
