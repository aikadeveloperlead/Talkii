import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Agent,
  Conversation,
  Decision,
  DomainError,
  Event,
  Funnel,
  Identity,
  Session,
  Tenant,
  type Channel,
} from "@/domain";
import { DuplicateExternalEventError } from "@/application/ports";
import type {
  AgentRepository,
  ConversationRepository,
  DecisionRepository,
  EventRepository,
  FunnelRepository,
  SessionRepository,
  TenantRepository,
} from "@/application/ports";
import {
  agentToRow,
  conversationToRow,
  decisionToRow,
  eventToRow,
  funnelToRow,
  rowToAgent,
  rowToConversation,
  rowToDecision,
  rowToEvent,
  rowToFunnel,
  rowToSession,
  rowToTenant,
  sessionToRow,
  tenantToRow,
  type AgentRow,
  type ConversationRow,
  type DecisionRow,
  type EventRow,
  type FunnelRow,
  type SessionRow,
  type TenantRow,
} from "./mappers";

/**
 * Implementaciones concretas de los puertos de repositorio sobre Supabase
 * (PostgreSQL + RLS). Cada repo recibe un `SupabaseClient` ya configurado
 * (con el JWT del usuario para que apliquen las políticas RLS por tenant).
 *
 * Regla de errores: un fallo de infraestructura se propaga como Error; NO se
 * traga en silencio (el dominio distingue entre "no existe" → null y "falló la
 * persistencia" → throw).
 */

import { throwIfUniqueViolation } from "./errors";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

export class SupabaseTenantRepository implements TenantRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(tenant: Tenant): Promise<void> {
    const { error } = await this.db.from("tenants").upsert(tenantToRow(tenant));
    if (error) fail("tenants.upsert", error);
  }

  async findById(id: Identity): Promise<Tenant | null> {
    const { data, error } = await this.db
      .from("tenants")
      .select("id,name,description,logo,status")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("tenants.select", error);
    return data ? rowToTenant(data as TenantRow) : null;
  }
}

export class SupabaseAgentRepository implements AgentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(agent: Agent): Promise<void> {
    const { error } = await this.db.from("agents").upsert(agentToRow(agent));
    throwIfUniqueViolation(error, "Agent: ya existe un Agent con ese nombre en el Tenant");
    if (error) fail("agents.upsert", error);
  }

  async findById(id: Identity): Promise<Agent | null> {
    const { data, error } = await this.db
      .from("agents")
      .select(
        "id,tenant_id,name,objective,permanent_prompt,policies,reasoning_profile,status,role,personality,language,tone,business_name,business_description,products_services,business_type,welcome_message,fallback_message,transfer_keywords,capture_fields,funnel_id",
      )
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("agents.select", error);
    return data ? rowToAgent(data as AgentRow) : null;
  }

  async findByName(tenantId: Identity, name: string): Promise<Agent | null> {
    const { data, error } = await this.db
      .from("agents")
      .select(
        "id,tenant_id,name,objective,permanent_prompt,policies,reasoning_profile,status,role,personality,language,tone,business_name,business_description,products_services,business_type,welcome_message,fallback_message,transfer_keywords,capture_fields,funnel_id",
      )
      .eq("tenant_id", tenantId.toString())
      .eq("name", name)
      .maybeSingle();
    if (error) fail("agents.select", error);
    return data ? rowToAgent(data as AgentRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Agent[]> {
    const { data, error } = await this.db
      .from("agents")
      .select(
        "id,tenant_id,name,objective,permanent_prompt,policies,reasoning_profile,status,role,personality,language,tone,business_name,business_description,products_services,business_type,welcome_message,fallback_message,transfer_keywords,capture_fields,funnel_id",
      )
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("agents.select", error);
    return (data as AgentRow[]).map(rowToAgent);
  }
}

export class SupabaseFunnelRepository implements FunnelRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(funnel: Funnel): Promise<void> {
    const { error } = await this.db.from("funnels").upsert(funnelToRow(funnel));
    throwIfUniqueViolation(error, "Funnel: ya existe un Funnel con ese nombre en el Tenant");
    if (error) fail("funnels.upsert", error);
  }

  async findById(id: Identity): Promise<Funnel | null> {
    const { data, error } = await this.db
      .from("funnels")
      .select("id,tenant_id,name,stages,description,ads_attribution,status")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("funnels.select", error);
    return data ? rowToFunnel(data as FunnelRow) : null;
  }

  async findByName(tenantId: Identity, name: string): Promise<Funnel | null> {
    const { data, error } = await this.db
      .from("funnels")
      .select("id,tenant_id,name,stages,description,ads_attribution,status")
      .eq("tenant_id", tenantId.toString())
      .eq("name", name)
      .maybeSingle();
    if (error) fail("funnels.select", error);
    return data ? rowToFunnel(data as FunnelRow) : null;
  }

  async listByTenant(tenantId: Identity): Promise<Funnel[]> {
    const { data, error } = await this.db
      .from("funnels")
      .select("id,tenant_id,name,stages,description,ads_attribution,status")
      .eq("tenant_id", tenantId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("funnels.select", error);
    return (data as FunnelRow[]).map(rowToFunnel);
  }
}

export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(conversation: Conversation): Promise<void> {
    const { error } = await this.db
      .from("conversations")
      .upsert(conversationToRow(conversation));
    if (error) fail("conversations.upsert", error);
  }

  async findById(id: Identity): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from("conversations")
      .select("id,tenant_id,channel,participants")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("conversations.select", error);
    return data ? rowToConversation(data as ConversationRow) : null;
  }

  async findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from("conversations")
      .select("id,tenant_id,channel,participants")
      .eq("tenant_id", tenantId.toString())
      .eq("channel", channel)
      .contains("participants", JSON.stringify([{ channelHandle: handle }]))
      .limit(1)
      .maybeSingle();
    if (error) fail("conversations.select", error);
    return data ? rowToConversation(data as ConversationRow) : null;
  }
}

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(session: Session): Promise<void> {
    const { error } = await this.db.from("sessions").upsert(sessionToRow(session));
    if (error) {
      // Postgres 23505 (unique_violation) sobre sessions_one_active_per_conversation
      // (0015_sessions_one_active.sql) — cierra la ventana de carrera de
      // resolveActiveSession/HandleInboundMessage (item 10 de auditoría).
      if ((error as { code?: string }).code === "23505") {
        throw new DomainError(
          "Session: ya existe una Session activa para esta Conversation",
        );
      }
      fail("sessions.upsert", error);
    }
  }

  async findById(id: Identity): Promise<Session | null> {
    const { data, error } = await this.db
      .from("sessions")
      .select("id,conversation_id,status,dimensions")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("sessions.select", error);
    return data ? rowToSession(data as SessionRow) : null;
  }

  async findActiveByConversation(
    conversationId: Identity,
  ): Promise<Session | null> {
    const { data, error } = await this.db
      .from("sessions")
      .select("id,conversation_id,status,dimensions")
      .eq("conversation_id", conversationId.toString())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("sessions.select", error);
    return data ? rowToSession(data as SessionRow) : null;
  }

  async findAllByConversation(conversationId: Identity): Promise<Session[]> {
    const { data, error } = await this.db
      .from("sessions")
      .select("id,conversation_id,status,dimensions")
      .eq("conversation_id", conversationId.toString())
      .order("created_at", { ascending: true });
    if (error) fail("sessions.select", error);
    return (data as SessionRow[]).map(rowToSession);
  }
}

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Los Events son hechos consumados: solo se anexan, nunca se mutan. */
  async append(event: Event): Promise<void> {
    const { error } = await this.db.from("events").insert(eventToRow(event));
    if (error) {
      // 23505 = unique_violation (índice único parcial sobre external_id).
      if (error.code === "23505" && event.externalId) {
        throw new DuplicateExternalEventError(event.externalId);
      }
      fail("events.insert", error);
    }
  }

  async findById(id: Identity): Promise<Event | null> {
    const { data, error } = await this.db
      .from("events")
      .select("id,session_id,type,occurred_at,payload,external_id")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("events.select", error);
    return data ? rowToEvent(data as EventRow) : null;
  }

  async findBySession(sessionId: Identity): Promise<Event[]> {
    const { data, error } = await this.db
      .from("events")
      .select("id,session_id,type,occurred_at,payload,external_id")
      .eq("session_id", sessionId.toString())
      .order("occurred_at", { ascending: true });
    if (error) fail("events.select", error);
    return (data as EventRow[]).map(rowToEvent);
  }

  async findBySessions(sessionIds: Identity[]): Promise<Event[]> {
    if (sessionIds.length === 0) return [];
    const { data, error } = await this.db
      .from("events")
      .select("id,session_id,type,occurred_at,payload,external_id")
      .in("session_id", sessionIds.map((id) => id.toString()))
      .order("occurred_at", { ascending: true });
    if (error) fail("events.select", error);
    return (data as EventRow[]).map(rowToEvent);
  }
}

export class SupabaseDecisionRepository implements DecisionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(decision: Decision): Promise<void> {
    const { error } = await this.db
      .from("decisions")
      .upsert(decisionToRow(decision));
    if (error) fail("decisions.upsert", error);
  }

  async findById(id: Identity): Promise<Decision | null> {
    const { data, error } = await this.db
      .from("decisions")
      .select("id,session_id,event_id,source,rationale,actions")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("decisions.select", error);
    return data ? rowToDecision(data as DecisionRow) : null;
  }

  async findBySession(sessionId: Identity): Promise<Decision[]> {
    const { data, error } = await this.db
      .from("decisions")
      .select("id,session_id,event_id,source,rationale,actions")
      .eq("session_id", sessionId.toString());
    if (error) fail("decisions.select", error);
    return (data as DecisionRow[]).map(rowToDecision);
  }
}
