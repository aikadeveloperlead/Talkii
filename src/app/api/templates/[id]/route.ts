import { NextResponse } from "next/server";
import { requireContainer, toErrorResponse, unauthorized } from "@/app/_lib/route-container";
import { updateTemplateSchema } from "@/app/_lib/validation";

/** GET/PUT/DELETE /api/templates/:id — SCR-006. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const detail = await container.getTemplateDetail.execute(id);
    if (!detail) return NextResponse.json({ error: "Template Not Found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    const body = updateTemplateSchema.parse(await request.json());
    await container.updateTemplate.execute({
      templateId: id,
      name: body.name,
      category: body.category,
      components: body.components,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const container = await requireContainer();
  if (!container) return unauthorized();
  try {
    const { id } = await params;
    await container.archiveTemplate.execute(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
