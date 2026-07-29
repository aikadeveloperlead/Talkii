// ── Kernel compartido ──
export * from "./shared";

// ── Entidades fundamentales del dominio (SSOT Cap. 7 §3) ──
export { Tenant } from "./identity-access/tenant";
export type { TenantProps } from "./identity-access/tenant";

export { Agent } from "./agent-strategy/agent";
export type {
  AgentProps,
  Policy,
  AgentStatus,
  CaptureField,
} from "./agent-strategy/agent";

export { Funnel } from "./conversational-strategy/funnel";
export type { FunnelProps, FunnelStage } from "./conversational-strategy/funnel";

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
