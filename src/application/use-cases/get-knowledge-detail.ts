import { Identity } from "@/domain";
import { KnowledgeRepository } from "../ports/knowledge-repositories";

export class GetKnowledgeDetail {
  constructor(private readonly knowledge: KnowledgeRepository) {}

  async execute(knowledgeId: string) {
    const document = await this.knowledge.findById(Identity.of(knowledgeId));
    if (!document) return null;
    return {
      id: document.id.toString(),
      title: document.title,
      categoryId: document.categoryId?.toString(),
      content: document.content,
      sourceType: document.sourceType,
      sourceFile: document.sourceFile,
      status: document.status,
      isActive: document.isActive,
    };
  }
}
