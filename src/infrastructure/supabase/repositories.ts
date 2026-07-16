import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Agent,
  Conversation,
  Decision,
  Event,
  Funnel,
  Identity,
  Session,
  Tenant,
} from "@/domain";
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
      .select("*")
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
    if (error) fail("agents.upsert", error);
  }

  async findById(id: Identity): Promise<Agent | null> {
    const { data, error } = await this.db
      .from("agents")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("agents.select", error);
    return data ? rowToAgent(data as AgentRow) : null;
  }
}

export class SupabaseFunnelRepository implements FunnelRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(funnel: Funnel): Promise<void> {
    const { error } = await this.db.from("funnels").upsert(funnelToRow(funnel));
    if (error) fail("funnels.upsert", error);
  }

  async findById(id: Identity): Promise<Funnel | null> {
    const { data, error } = await this.db
      .from("funnels")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("funnels.select", error);
    return data ? rowToFunnel(data as FunnelRow) : null;
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
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("conversations.select", error);
    return data ? rowToConversation(data as ConversationRow) : null;
  }
}

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(session: Session): Promise<void> {
    const { error } = await this.db.from("sessions").upsert(sessionToRow(session));
    if (error) fail("sessions.upsert", error);
  }

  async findById(id: Identity): Promise<Session | null> {
    const { data, error } = await this.db
      .from("sessions")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("sessions.select", error);
    return data ? rowToSession(data as SessionRow) : null;
  }
}

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Los Events son hechos consumados: solo se anexan, nunca se mutan. */
  async append(event: Event): Promise<void> {
    const { error } = await this.db.from("events").insert(eventToRow(event));
    if (error) fail("events.insert", error);
  }

  async findById(id: Identity): Promise<Event | null> {
    const { data, error } = await this.db
      .from("events")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("events.select", error);
    return data ? rowToEvent(data as EventRow) : null;
  }

  async findBySession(sessionId: Identity): Promise<Event[]> {
    const { data, error } = await this.db
      .from("events")
      .select("*")
      .eq("session_id", sessionId.toString())
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

  async findBySession(sessionId: Identity): Promise<Decision[]> {
    const { data, error } = await this.db
      .from("decisions")
      .select("*")
      .eq("session_id", sessionId.toString());
    if (error) fail("decisions.select", error);
    return (data as DecisionRow[]).map(rowToDecision);
  }
}
