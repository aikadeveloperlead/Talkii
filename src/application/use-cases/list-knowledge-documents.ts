import { Identity } from "@/domain";
import { KnowledgeRepository } from "../ports/knowledge-repositories";

export class ListKnowledgeDocuments {
  constructor(private readonly knowledge: KnowledgeRepository) {}

  async execute(tenantId: string) {
    const documents = await this.knowledge.listByTenant(Identity.of(tenantId));
    return documents.map((d) => ({
      id: d.id.toString(),
      title: d.title,
      categoryId: d.categoryId?.toString(),
      status: d.status,
      isActive: d.isActive,
    }));
  }
}
