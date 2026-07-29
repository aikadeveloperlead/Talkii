import {
  Category,
  Identity,
  KnowledgeDocument,
  type KnowledgeSourceType,
  type KnowledgeStatus,
} from "@/domain";

export interface CategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
}
export function categoryToRow(category: Category): CategoryRow {
  return {
    id: category.id.toString(),
    tenant_id: category.tenantId.toString(),
    name: category.name,
    color: category.color ?? null,
  };
}
export function rowToCategory(row: CategoryRow): Category {
  return Category.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    color: row.color ?? undefined,
  });
}

export interface KnowledgeRow {
  id: string;
  tenant_id: string;
  title: string;
  category_id: string | null;
  content: string;
  source_type: KnowledgeSourceType;
  source_file: string | null;
  status: KnowledgeStatus;
  is_active: boolean;
}
export function knowledgeToRow(document: KnowledgeDocument): KnowledgeRow {
  return {
    id: document.id.toString(),
    tenant_id: document.tenantId.toString(),
    title: document.title,
    category_id: document.categoryId?.toString() ?? null,
    content: document.content,
    source_type: document.sourceType,
    source_file: document.sourceFile ?? null,
    status: document.status,
    is_active: document.isActive,
  };
}
export function rowToKnowledge(row: KnowledgeRow): KnowledgeDocument {
  return KnowledgeDocument.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    title: row.title,
    categoryId: row.category_id ? Identity.of(row.category_id) : undefined,
    content: row.content,
    sourceType: row.source_type,
    sourceFile: row.source_file ?? undefined,
    status: row.status,
    isActive: row.is_active,
  });
}
