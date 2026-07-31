import { DomainError, Identity, NotFoundError, type TemplateCategory, type TemplateComponents } from "@/domain";
import { TemplateRepository } from "../ports/template-repository";

/** UpdateTemplate — SCR-006 (solo editable en estado "draft"; una plantilla aprobada requiere nueva versión, fuera de esta pasada). */
export interface UpdateTemplateInput {
  templateId: string;
  name?: string;
  category?: TemplateCategory;
  components?: TemplateComponents;
}

export class UpdateTemplate {
  constructor(private readonly templates: TemplateRepository) {}

  async execute(input: UpdateTemplateInput): Promise<void> {
    const template = await this.templates.findById(Identity.of(input.templateId));
    if (!template) {
      throw new NotFoundError("UpdateTemplate: la plantilla no existe");
    }
    if (!template.isEditable) {
      throw new DomainError("UpdateTemplate: solo se pueden editar plantillas en estado draft");
    }

    const { templateId: _omit, ...changes } = input;
    await this.templates.save(template.withEdits(changes));
  }
}
