import { Identity, NotFoundError } from "@/domain";
import { KnowledgeRepository } from "../ports/knowledge-repositories";

/** UpdateKnowledgeDocument — SCR-009 (BK-03: editar regresa el estado a "pending"). */
export interface UpdateKnowledgeDocumentInput {
  knowledgeId: string;
  title?: string;
  categoryId?: string;
  content?: string;
}

export class UpdateKnowledgeDocument {
  constructor(private readonly knowledge: KnowledgeRepository) {}

  async execute(input: UpdateKnowledgeDocumentInput): Promise<void> {
    const document = await this.knowledge.findById(Identity.of(input.knowledgeId));
    if (!document) {
      throw new NotFoundError("UpdateKnowledgeDocument: el documento no existe");
    }
    await this.knowledge.save(
      document.withEdits({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.categoryId !== undefined && { categoryId: Identity.of(input.categoryId) }),
        ...(input.content !== undefined && { content: input.content }),
      }),
    );
  }
}
