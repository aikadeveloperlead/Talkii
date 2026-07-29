import { Identity } from "@/domain";
import { TemplateRepository } from "../ports/template-repository";

/** GetTemplateDetail — SCR-006. */
export class GetTemplateDetail {
  constructor(private readonly templates: TemplateRepository) {}

  async execute(templateId: string) {
    const template = await this.templates.findById(Identity.of(templateId));
    if (!template) return null;
    return {
      id: template.id.toString(),
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components,
      status: template.status,
      qualityRating: template.qualityRating,
      version: template.version,
      archived: template.isArchived,
    };
  }
}
