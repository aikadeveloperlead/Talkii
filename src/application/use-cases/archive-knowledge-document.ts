import { Identity, NotFoundError } from "@/domain";
import { KnowledgeRepository } from "../ports/knowledge-repositories";

/** ArchiveKnowledgeDocument — SCR-009 §7 knowledge.archived (BK-04: eliminación lógica). */
export class ArchiveKnowledgeDocument {
  constructor(private readonly knowledge: KnowledgeRepository) {}

  async execute(knowledgeId: string): Promise<void> {
    const document = await this.knowledge.findById(Identity.of(knowledgeId));
    if (!document) {
      throw new NotFoundError("ArchiveKnowledgeDocument: el documento no existe");
    }
    await this.knowledge.save(document.archived());
  }
}
