import { Identity, KnowledgeDocument, type KnowledgeSourceType } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { KnowledgeRepository } from "../ports/knowledge-repositories";

/** CreateKnowledgeDocument — SCR-009 (BK-01: todo documento nuevo inicia como "pending"). */
export interface CreateKnowledgeDocumentInput {
  tenantId: string;
  title: string;
  categoryId?: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceFile?: string;
}

export class CreateKnowledgeDocument {
  constructor(
    private readonly ids: IdGenerator,
    private readonly knowledge: KnowledgeRepository,
  ) {}

  async execute(input: CreateKnowledgeDocumentInput): Promise<{ knowledgeId: string }> {
    const document = KnowledgeDocument.create(this.ids.next(), {
      tenantId: Identity.of(input.tenantId),
      title: input.title,
      categoryId: input.categoryId ? Identity.of(input.categoryId) : undefined,
      content: input.content,
      sourceType: input.sourceType,
      sourceFile: input.sourceFile,
      status: "pending",
      isActive: true,
    });
    await this.knowledge.save(document);
    return { knowledgeId: document.id.toString() };
  }
}
