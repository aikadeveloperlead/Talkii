import { Identity, WhatsAppTemplate } from "@/domain";

/** Puerto de persistencia del bounded context Templates (SCR-006). */
export interface TemplateRepository {
  save(template: WhatsAppTemplate): Promise<void>;
  findById(id: Identity): Promise<WhatsAppTemplate | null>;
  listByTenant(tenantId: Identity, includeArchived?: boolean): Promise<WhatsAppTemplate[]>;
}
