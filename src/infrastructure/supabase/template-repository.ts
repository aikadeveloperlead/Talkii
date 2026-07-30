import type { SupabaseClient } from "@supabase/supabase-js";
import { Identity, WhatsAppTemplate } from "@/domain";
import type { TemplateRepository } from "@/application/ports";
import { rowToTemplate, templateToRow, type TemplateRow } from "./template-mappers";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

/** Item BAJO #21 de la auditoría: columnas explícitas en vez de select("*"). */
const TEMPLATE_COLUMNS =
  "id,tenant_id,name,language,category,header_type,header_content,body,footer,buttons,status,quality_rating,version,archived_at";

export class SupabaseTemplateRepository implements TemplateRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(template: WhatsAppTemplate): Promise<void> {
    const { error } = await this.db.from("whatsapp_templates").upsert(templateToRow(template));
    if (error) fail("whatsapp_templates.upsert", error);
  }

  async findById(id: Identity): Promise<WhatsAppTemplate | null> {
    const { data, error } = await this.db
      .from("whatsapp_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("whatsapp_templates.select", error);
    return data ? rowToTemplate(data as TemplateRow) : null;
  }

  async listByTenant(tenantId: Identity, includeArchived = false): Promise<WhatsAppTemplate[]> {
    let query = this.db
      .from("whatsapp_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("tenant_id", tenantId.toString());
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) fail("whatsapp_templates.select", error);
    return (data as TemplateRow[]).map(rowToTemplate);
  }
}
