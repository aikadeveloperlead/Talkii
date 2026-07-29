import { NextResponse } from "next/server";
import { requireTenantContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";

/** GET/POST /api/agents — SCR-008 §6.1. */
export async function GET() {
  const scope = await requireTenantContainer();
  if (!scope) return unauthorized();
  try {
    return NextResponse.json({ items: await scope.container.listAgents.execute(scope.tenantId) });
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
      typeof body.name !== "string" ||
      typeof body.role !== "string" ||
      typeof body.objective !== "string" ||
      typeof body.permanentPrompt !== "string" ||
      typeof body.reasoningProfile !== "string"
    ) {
      return NextResponse.json({ error: "Validation error." }, { status: 422 });
    }
    const result = await scope.container.createAgent.execute({
      tenantId: scope.tenantId,
      name: body.name,
      role: body.role,
      objective: body.objective,
      permanentPrompt: body.permanentPrompt,
      reasoningProfile: body.reasoningProfile,
      personality: body.personality,
      language: body.language,
      tone: body.tone,
      businessName: body.businessName,
      businessDescription: body.businessDescription,
      productsServices: body.productsServices,
      businessType: body.businessType,
      welcomeMessage: body.welcomeMessage,
      fallbackMessage: body.fallbackMessage,
      transferKeywords: body.transferKeywords,
      captureFields: body.captureFields,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
