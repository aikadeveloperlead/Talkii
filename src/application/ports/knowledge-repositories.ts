import { Category, Identity, KnowledgeDocument } from "@/domain";

export interface CategoryRepository {
  save(category: Category): Promise<void>;
  findById(id: Identity): Promise<Category | null>;
  listByTenant(tenantId: Identity): Promise<Category[]>;
  delete(id: Identity): Promise<void>;
}

export interface KnowledgeRepository {
  save(document: KnowledgeDocument): Promise<void>;
  findById(id: Identity): Promise<KnowledgeDocument | null>;
  listByTenant(tenantId: Identity, includeArchived?: boolean): Promise<KnowledgeDocument[]>;
}

/** Asociación Knowledge↔Agent (SCR-009 §6.5 / SCR-008 §6.3, BK-05: N:N). */
export interface AgentKnowledgeRepository {
  link(agentId: Identity, knowledgeId: Identity): Promise<void>;
  unlink(agentId: Identity, knowledgeId: Identity): Promise<void>;
  listByAgent(agentId: Identity): Promise<Identity[]>;
}
