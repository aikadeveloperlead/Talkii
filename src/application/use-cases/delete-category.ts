import { Identity } from "@/domain";
import { CategoryRepository } from "../ports/knowledge-repositories";

export class DeleteCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(categoryId: string): Promise<void> {
    await this.categories.delete(Identity.of(categoryId));
  }
}
