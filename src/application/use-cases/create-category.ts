import { Category, Identity } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { CategoryRepository } from "../ports/knowledge-repositories";

export interface CreateCategoryInput {
  tenantId: string;
  name: string;
  color?: string;
}

export class CreateCategory {
  constructor(
    private readonly ids: IdGenerator,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(input: CreateCategoryInput): Promise<{ categoryId: string }> {
    const category = Category.create(this.ids.next(), {
      tenantId: Identity.of(input.tenantId),
      name: input.name,
      color: input.color,
    });
    await this.categories.save(category);
    return { categoryId: category.id.toString() };
  }
}
