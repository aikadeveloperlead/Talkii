import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain";
import {
  ArchiveTemplate,
  CreateTemplate,
  GetTemplateDetail,
  ListTemplates,
  UpdateTemplate,
} from "@/application/use-cases";
import { FixedClock, InMemoryTemplates, SequentialIds } from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const templates = new InMemoryTemplates();
  return {
    templates,
    createTemplate: new CreateTemplate(ids, templates),
    updateTemplate: new UpdateTemplate(templates),
    archiveTemplate: new ArchiveTemplate(clock, templates),
    getDetail: new GetTemplateDetail(templates),
    listTemplates: new ListTemplates(templates),
  };
}

describe("CreateTemplate / UpdateTemplate (SCR-006 — solo editable en draft)", () => {
  it("crea en estado draft, versión 1, y permite editarla", async () => {
    const { createTemplate, updateTemplate, getDetail } = setup();
    const { templateId } = await createTemplate.execute({
      tenantId,
      name: "Bienvenida",
      language: "es",
      category: "UTILITY",
      components: { body: "Hola {{1}}", buttons: [] },
    });

    expect((await getDetail.execute(templateId))?.status).toBe("draft");

    await updateTemplate.execute({ templateId, name: "Bienvenida v2" });
    expect((await getDetail.execute(templateId))?.name).toBe("Bienvenida v2");
  });

  it("rechaza Body vacío", async () => {
    const { createTemplate } = setup();
    await expect(
      createTemplate.execute({
        tenantId,
        name: "X",
        language: "es",
        category: "MARKETING",
        components: { body: "  ", buttons: [] },
      }),
    ).rejects.toThrow(DomainError);
  });
});

describe("ArchiveTemplate / ListTemplates", () => {
  it("archiva y la excluye del listado por defecto", async () => {
    const { createTemplate, archiveTemplate, listTemplates } = setup();
    const { templateId } = await createTemplate.execute({
      tenantId,
      name: "A",
      language: "es",
      category: "UTILITY",
      components: { body: "hola", buttons: [] },
    });

    expect(await listTemplates.execute(tenantId)).toHaveLength(1);
    await archiveTemplate.execute(templateId);
    expect(await listTemplates.execute(tenantId)).toHaveLength(0);
  });
});
