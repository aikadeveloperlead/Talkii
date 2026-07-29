// ── Kernel compartido ──
export * from "./shared";

// ── Entidades fundamentales del dominio (SSOT Cap. 7 §3) ──
export { Tenant } from "./identity-access/tenant";
export type { TenantProps, WorkspaceStatus } from "./identity-access/tenant";

// ── Administration (SCR-012 — Workspace/Company/Preferences; Users/Roles diferidos) ──
export { Company } from "./administration/company";
export type { CompanyProps } from "./administration/company";
export { Preferences } from "./administration/preferences";
export type { PreferencesProps } from "./administration/preferences";

export { Agent } from "./agent-strategy/agent";
export type {
  AgentProps,
  Policy,
  AgentStatus,
  CaptureField,
} from "./agent-strategy/agent";

export { Funnel } from "./conversational-strategy/funnel";
export type {
  FunnelProps,
  FunnelStage,
  FunnelStatus,
} from "./conversational-strategy/funnel";

export { Conversation } from "./conversation/conversation";
export type {
  ConversationProps,
  Channel,
  Participant,
} from "./conversation/conversation";

export { Session } from "./execution/session";
export type {
  SessionProps,
  SessionState,
  SessionStatus,
  SessionDimensions,
} from "./execution/session";

export { Event } from "./execution/event";
export type { EventProps } from "./execution/event";

export { Decision } from "./execution/decision";
export type {
  DecisionProps,
  DecisionSource,
  Action,
} from "./execution/decision";

// ── CRM (SCR-003 — implementación propietaria de la Tool UpdateCustomer) ──
export { Customer } from "./crm/customer";
export type { CustomerProps } from "./crm/customer";

export { Lead } from "./crm/lead";
export type { LeadProps, LeadStatus } from "./crm/lead";

export { CustomerTimelineEntry } from "./crm/customer-timeline-entry";
export type { CustomerTimelineEntryProps } from "./crm/customer-timeline-entry";

// ── Scheduling (SCR-004 — Agenda) ──
export { Calendar } from "./scheduling/calendar";
export type { CalendarProps } from "./scheduling/calendar";

export { Appointment } from "./scheduling/appointment";
export type { AppointmentProps, AppointmentStatus } from "./scheduling/appointment";

export { AppointmentTimelineEntry } from "./scheduling/appointment-timeline-entry";
export type { AppointmentTimelineEntryProps } from "./scheduling/appointment-timeline-entry";

// ── Templates (SCR-006 — Plantillas WhatsApp/Meta, ciclo Draft local) ──
export { WhatsAppTemplate } from "./templates/whatsapp-template";
export type {
  WhatsAppTemplateProps,
  TemplateCategory,
  TemplateStatus,
  QualityRating,
  TemplateComponents,
  TemplateButton,
} from "./templates/whatsapp-template";

// ── Knowledge (SCR-009 — sin motor de embeddings, n8n removido) ──
export { Category } from "./knowledge/category";
export type { CategoryProps } from "./knowledge/category";
export { KnowledgeDocument } from "./knowledge/knowledge-document";
export type {
  KnowledgeDocumentProps,
  KnowledgeSourceType,
  KnowledgeStatus,
} from "./knowledge/knowledge-document";

// ── Webhooks & Integraciones (SCR-011 — sin retries/colas/OAuth) ──
export { Webhook } from "./webhooks/webhook";
export type { WebhookProps, WebhookStatus } from "./webhooks/webhook";
export { WebhookDelivery } from "./webhooks/webhook-delivery";
export type {
  WebhookDeliveryProps,
  WebhookDeliveryStatus,
} from "./webhooks/webhook-delivery";
