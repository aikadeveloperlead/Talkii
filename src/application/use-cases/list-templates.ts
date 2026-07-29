import { Identity } from "@/domain";
import { TemplateRepository } from "../ports/template-repository";

/** ListTemplates — SCR-006 (catálogo del Tenant). */
export class ListTemplates {
  constructor(private readonly templates: TemplateRepository) {}

  async execute(tenantId: string) {
    const templates = await this.templates.listByTenant(Identity.of(tenantId));
    return templates.map((t) => ({
      id: t.id.toString(),
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      version: t.version,
      archived: t.isArchived,
    }));
  }
}
