import { Identity } from "@/domain";
import { CategoryRepository } from "../ports/knowledge-repositories";

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(tenantId: string) {
    const categories = await this.categories.listByTenant(Identity.of(tenantId));
    return categories.map((c) => ({ id: c.id.toString(), name: c.name, color: c.color }));
  }
}
