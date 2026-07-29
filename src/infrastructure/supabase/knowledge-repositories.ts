import type { SupabaseClient } from "@supabase/supabase-js";
import { Category, Identity, KnowledgeDocument } from "@/domain";
import type {
  AgentKnowledgeRepository,
  CategoryRepository,
  KnowledgeRepository,
} from "@/application/ports";
import {
  categoryToRow,
  knowledgeToRow,
  rowToCategory,
  rowToKnowledge,
  type CategoryRow,
  type KnowledgeRow,
} from "./knowledge-mappers";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

export class SupabaseCategoryRepository implements CategoryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(category: Category): Promise<void> {
    const { error } = await this.db.from("knowledge_categories").upsert(categoryToRow(category));
    if (error) fail("knowledge_categories.upsert", error);
  }

  async findById(id: Identity): Promise<Category | null> {
    const { data, error } = await this.db
      .from("knowledge_categories")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("knowledge_categories.select", error);
    return data ? rowToCategory(data as CategoryRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Category[]> {
    const { data, error } = await this.db
      .from("knowledge_categories")
      .select("*")
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("knowledge_categories.select", error);
    return (data as CategoryRow[]).map(rowToCategory);
  }

  async delete(id: Identity): Promise<void> {
    const { error } = await this.db.from("knowledge_categories").delete().eq("id", id.toString());
    if (error) fail("knowledge_categories.delete", error);
  }
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(document: KnowledgeDocument): Promise<void> {
    const { error } = await this.db.from("knowledge_documents").upsert(knowledgeToRow(document));
    if (error) fail("knowledge_documents.upsert", error);
  }

  async findById(id: Identity): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.db
      .from("knowledge_documents")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("knowledge_documents.select", error);
    return data ? rowToKnowledge(data as KnowledgeRow) : null;
  }

  async listByTenant(tenantId: Identity, includeArchived = false): Promise<KnowledgeDocument[]> {
    let query = this.db.from("knowledge_documents").select("*").eq("tenant_id", tenantId.toString());
    if (!includeArchived) query = query.neq("status", "archived");
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) fail("knowledge_documents.select", error);
    return (data as KnowledgeRow[]).map(rowToKnowledge);
  }
}

export class SupabaseAgentKnowledgeRepository implements AgentKnowledgeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async link(agentId: Identity, knowledgeId: Identity): Promise<void> {
    const { error } = await this.db
      .from("agent_knowledge")
      .upsert(
        { agent_id: agentId.toString(), knowledge_id: knowledgeId.toString() },
        { onConflict: "agent_id,knowledge_id" },
      );
    if (error) fail("agent_knowledge.upsert", error);
  }

  async unlink(agentId: Identity, knowledgeId: Identity): Promise<void> {
    const { error } = await this.db
      .from("agent_knowledge")
      .delete()
      .eq("agent_id", agentId.toString())
      .eq("knowledge_id", knowledgeId.toString());
    if (error) fail("agent_knowledge.delete", error);
  }

  async listByAgent(agentId: Identity): Promise<Identity[]> {
    const { data, error } = await this.db
      .from("agent_knowledge")
      .select("knowledge_id")
      .eq("agent_id", agentId.toString());
    if (error) fail("agent_knowledge.select", error);
    return (data as { knowledge_id: string }[]).map((row) => Identity.of(row.knowledge_id));
  }
}
