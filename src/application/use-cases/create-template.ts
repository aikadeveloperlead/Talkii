import { Identity, WhatsAppTemplate, type TemplateCategory, type TemplateComponents } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { TemplateRepository } from "../ports/template-repository";

/** CreateTemplate — SCR-006 (nace en estado "draft", versión 1; el envío a revisión de Meta queda fuera de esta pasada). */
export interface CreateTemplateInput {
  tenantId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponents;
}

export class CreateTemplate {
  constructor(
    private readonly ids: IdGenerator,
    private readonly templates: TemplateRepository,
  ) {}

  async execute(input: CreateTemplateInput): Promise<{ templateId: string }> {
    const template = WhatsAppTemplate.create(this.ids.next(), {
      tenantId: Identity.of(input.tenantId),
      name: input.name,
      language: input.language,
      category: input.category,
      components: input.components,
      status: "draft",
      version: 1,
    });
    await this.templates.save(template);
    return { templateId: template.id.toString() };
  }
}
