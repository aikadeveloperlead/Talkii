import {
  Identity,
  WhatsAppTemplate,
  type QualityRating,
  type TemplateButton,
  type TemplateCategory,
  type TemplateStatus,
} from "@/domain";

export interface TemplateRow {
  id: string;
  tenant_id: string;
  name: string;
  language: string;
  category: TemplateCategory;
  header_type: string | null;
  header_content: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  status: TemplateStatus;
  quality_rating: QualityRating | null;
  version: number;
  archived_at: string | null;
}

export function templateToRow(template: WhatsAppTemplate): TemplateRow {
  return {
    id: template.id.toString(),
    tenant_id: template.tenantId.toString(),
    name: template.name,
    language: template.language,
    category: template.category,
    header_type: template.components.headerType ?? null,
    header_content: template.components.headerContent ?? null,
    body: template.components.body,
    footer: template.components.footer ?? null,
    buttons: [...template.components.buttons],
    status: template.status,
    quality_rating: template.qualityRating ?? null,
    version: template.version,
    archived_at: template.archivedAt ? template.archivedAt.toISOString() : null,
  };
}

export function rowToTemplate(row: TemplateRow): WhatsAppTemplate {
  return WhatsAppTemplate.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    language: row.language,
    category: row.category,
    components: {
      headerType: (row.header_type as "text" | "image" | "video" | "document" | "location") ?? undefined,
      headerContent: row.header_content ?? undefined,
      body: row.body,
      footer: row.footer ?? undefined,
      buttons: row.buttons ?? [],
    },
    status: row.status,
    qualityRating: row.quality_rating ?? undefined,
    version: row.version,
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
  });
}
