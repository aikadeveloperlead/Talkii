import { DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { TemplateRepository } from "../ports/template-repository";

/** ArchiveTemplate — SCR-006 (ciclo de vida termina en Archived). */
export class ArchiveTemplate {
  constructor(
    private readonly clock: Clock,
    private readonly templates: TemplateRepository,
  ) {}

  async execute(templateId: string): Promise<void> {
    const template = await this.templates.findById(Identity.of(templateId));
    if (!template) {
      throw new DomainError("ArchiveTemplate: la plantilla no existe");
    }
    await this.templates.save(template.archived(this.clock.now()));
  }
}
