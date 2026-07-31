import {
  Agent,
  Conversation,
  Decision,
  Event,
  Funnel,
  Identity,
  Session,
  Tenant,
  type Action,
  type Channel,
  type DecisionSource,
  type FunnelStage,
  type Participant,
  type Policy,
  type SessionDimensions,
} from "@/domain";

/**
 * Mappers de persistencia (SSOT Regla 12): traducen entre las filas de Supabase
 * (snake_case, JSONB) y las entidades del dominio. Toda reconstrucción pasa por
 * el `create()` de la entidad, de modo que los invariantes se revalidan también
 * al leer de la base de datos.
 *
 * Nota multi-tenant: `tenant_id` se persiste explícitamente en las entidades que
 * lo exponen (Tenant, Agent, Funnel, Conversation). Session/Event/Decision NO
 * exponen `tenantId` en el dominio; su pertenencia al Tenant es transitiva vía
 * la Conversation y se hace cumplir en las políticas RLS (cadena EXISTS).
 */

// ── Tipos de fila (reflejan el esquema SQL) ──
export interface TenantRow {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  status: string;
  owner_user_id: string | null;
}
export interface AgentRow {
  id: string;
  tenant_id: string;
  name: string;
  objective: string;
  permanent_prompt: string;
  policies: Policy[];
  reasoning_profile: string;
  status: string;
  role: string | null;
  personality: string | null;
  language: string | null;
  tone: string | null;
  business_name: string | null;
  business_description: string | null;
  products_services: string | null;
  business_type: string | null;
  welcome_message: string | null;
  fallback_message: string | null;
  transfer_keywords: string[];
  capture_fields: { key: string; label: string }[];
  funnel_id: string | null;
}
export interface FunnelRow {
  id: string;
  tenant_id: string;
  name: string;
  stages: FunnelStage[];
  description: string | null;
  ads_attribution: boolean;
  status: string;
}
export interface ConversationRow {
  id: string;
  tenant_id: string;
  channel: Channel;
  participants: Participant[];
}
interface TimelineEntryRow {
  at: string;
  kind: string;
}
export interface SessionRow {
  id: string;
  conversation_id: string;
  status: string;
  dimensions: Omit<SessionDimensions, "timeline"> & {
    timeline: TimelineEntryRow[];
  };
}
export interface EventRow {
  id: string;
  session_id: string;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  external_id: string | null;
}
export interface DecisionRow {
  id: string;
  session_id: string;
  event_id: string;
  source: DecisionSource;
  rationale: string;
  actions: Action[];
}

// ── Tenant ──
export function tenantToRow(tenant: Tenant): TenantRow {
  return {
    id: tenant.id.toString(),
    name: tenant.name,
    description: tenant.description ?? null,
    logo: tenant.logo ?? null,
    status: tenant.status,
    owner_user_id: tenant.ownerUserId ?? null,
  };
}
export function rowToTenant(row: TenantRow): Tenant {
  return Tenant.create(Identity.of(row.id), {
    name: row.name,
    description: row.description ?? undefined,
    logo: row.logo ?? undefined,
    status: row.status as Tenant["status"],
    ownerUserId: row.owner_user_id ?? undefined,
  });
}

// ── Agent ──
export function agentToRow(agent: Agent): AgentRow {
  return {
    id: agent.id.toString(),
    tenant_id: agent.tenantId.toString(),
    name: agent.name,
    objective: agent.objective,
    permanent_prompt: agent.permanentPrompt,
    policies: [...agent.policies],
    reasoning_profile: agent.reasoningProfile,
    status: agent.status,
    role: agent.role ?? null,
    personality: agent.personality ?? null,
    language: agent.language ?? null,
    tone: agent.tone ?? null,
    business_name: agent.businessName ?? null,
    business_description: agent.businessDescription ?? null,
    products_services: agent.productsServices ?? null,
    business_type: agent.businessType ?? null,
    welcome_message: agent.welcomeMessage ?? null,
    fallback_message: agent.fallbackMessage ?? null,
    transfer_keywords: [...agent.transferKeywords],
    capture_fields: [...agent.captureFields],
    funnel_id: agent.funnelId?.toString() ?? null,
  };
}
export function rowToAgent(row: AgentRow): Agent {
  return Agent.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    objective: row.objective,
    permanentPrompt: row.permanent_prompt,
    policies: row.policies ?? [],
    reasoningProfile: row.reasoning_profile,
    status: row.status as Agent["status"],
    role: row.role ?? undefined,
    personality: row.personality ?? undefined,
    language: row.language ?? undefined,
    tone: row.tone ?? undefined,
    businessName: row.business_name ?? undefined,
    businessDescription: row.business_description ?? undefined,
    productsServices: row.products_services ?? undefined,
    businessType: row.business_type ?? undefined,
    welcomeMessage: row.welcome_message ?? undefined,
    fallbackMessage: row.fallback_message ?? undefined,
    transferKeywords: row.transfer_keywords ?? [],
    captureFields: row.capture_fields ?? [],
    funnelId: row.funnel_id ? Identity.of(row.funnel_id) : undefined,
  });
}

// ── Funnel ──
export function funnelToRow(funnel: Funnel): FunnelRow {
  return {
    id: funnel.id.toString(),
    tenant_id: funnel.tenantId.toString(),
    name: funnel.name,
    stages: [...funnel.stages],
    description: funnel.description ?? null,
    ads_attribution: funnel.adsAttribution,
    status: funnel.status,
  };
}
export function rowToFunnel(row: FunnelRow): Funnel {
  return Funnel.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    name: row.name,
    stages: row.stages ?? [],
    description: row.description ?? undefined,
    adsAttribution: row.ads_attribution,
    status: row.status as Funnel["status"],
  });
}

// ── Conversation ──
export function conversationToRow(conversation: Conversation): ConversationRow {
  return {
    id: conversation.id.toString(),
    tenant_id: conversation.tenantId.toString(),
    channel: conversation.channel,
    participants: [...conversation.participants],
  };
}
export function rowToConversation(row: ConversationRow): Conversation {
  return Conversation.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    channel: row.channel,
    participants: row.participants ?? [],
  });
}

// ── Session ──
export function sessionToRow(session: Session): SessionRow {
  const d = session.dimensions;
  return {
    id: session.id.toString(),
    conversation_id: session.conversationId.toString(),
    status: session.state.status,
    dimensions: {
      state: d.state,
      memory: d.memory,
      context: d.context,
      timeline: d.timeline.map((t) => ({ at: t.at.toISOString(), kind: t.kind })),
      variables: d.variables,
      metadata: d.metadata,
    },
  };
}
export function rowToSession(row: SessionRow): Session {
  const dimensions: SessionDimensions = {
    state: row.dimensions.state,
    memory: row.dimensions.memory,
    context: row.dimensions.context,
    timeline: row.dimensions.timeline.map((t) => ({
      at: new Date(t.at),
      kind: t.kind,
    })),
    variables: row.dimensions.variables,
    metadata: row.dimensions.metadata,
  };
  return Session.create(Identity.of(row.id), {
    conversationId: Identity.of(row.conversation_id),
    dimensions,
  });
}

// ── Event ──
export function eventToRow(event: Event): EventRow {
  return {
    id: event.id.toString(),
    session_id: event.sessionId.toString(),
    type: event.type,
    occurred_at: event.occurredAt.toISOString(),
    payload: { ...event.payload },
    external_id: event.externalId ?? null,
  };
}
export function rowToEvent(row: EventRow): Event {
  return Event.create(Identity.of(row.id), {
    sessionId: Identity.of(row.session_id),
    type: row.type,
    occurredAt: new Date(row.occurred_at),
    payload: row.payload ?? {},
    externalId: row.external_id ?? undefined,
  });
}

// ── Decision ──
export function decisionToRow(decision: Decision): DecisionRow {
  return {
    id: decision.id.toString(),
    session_id: decision.sessionId.toString(),
    event_id: decision.eventId.toString(),
    source: decision.source,
    rationale: decision.rationale,
    actions: [...decision.actions],
  };
}
export function rowToDecision(row: DecisionRow): Decision {
  return Decision.create(Identity.of(row.id), {
    sessionId: Identity.of(row.session_id),
    eventId: Identity.of(row.event_id),
    source: row.source,
    rationale: row.rationale,
    actions: row.actions ?? [],
  });
}
