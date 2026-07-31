import {
  Agent,
  Conversation,
  Decision,
  Event,
  Funnel,
  Identity,
  Session,
  Tenant,
  type Channel,
} from "@/domain";

/**
 * Puertos de persistencia (repositorios).
 *
 * Son interfaces: `application` define el contrato, `infrastructure` lo
 * implementa (SSOT Regla 12 — dependencias hacia el dominio). El aislamiento
 * multi-tenant se garantiza en la implementación (Supabase RLS + tenant_id);
 * conceptualmente todo recurso pertenece a un único Tenant (SSOT Cap. 7 §4).
 */

/**
 * Un Event con `externalId` ya ingerido: el canal externo reintentó la entrega
 * (p. ej. reintentos del webhook de Meta). El caso de uso lo trata como
 * idempotencia, no como fallo.
 */
export class DuplicateExternalEventError extends Error {
  constructor(externalId: string) {
    super(`Event duplicado: external_id=${externalId} ya fue ingerido`);
    this.name = "DuplicateExternalEventError";
  }
}

export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  findById(id: Identity): Promise<Tenant | null>;
}

export interface AgentRepository {
  save(agent: Agent): Promise<void>;
  findById(id: Identity): Promise<Agent | null>;
  /** Para validar unicidad de nombre por Tenant (SCR-008 BK-02). */
  findByName(tenantId: Identity, name: string): Promise<Agent | null>;
  listByTenant(tenantId: Identity): Promise<Agent[]>;
}

export interface FunnelRepository {
  save(funnel: Funnel): Promise<void>;
  findById(id: Identity): Promise<Funnel | null>;
  /** Para validar unicidad de nombre por Tenant (SCR-010 BK-01). */
  findByName(tenantId: Identity, name: string): Promise<Funnel | null>;
  listByTenant(tenantId: Identity): Promise<Funnel[]>;
}

export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findById(id: Identity): Promise<Conversation | null>;
  /** Relación existente con un participante en un canal (p. ej. wa_id). */
  findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null>;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: Identity): Promise<Session | null>;
  /** Session activa más reciente de la Conversation, o null si no hay. */
  findActiveByConversation(conversationId: Identity): Promise<Session | null>;
  /** Todas las Sessions de la Conversation (activas o cerradas), orden cronológico. */
  findAllByConversation(conversationId: Identity): Promise<Session[]>;
}

export interface EventRepository {
  append(event: Event): Promise<void>;
  findById(id: Identity): Promise<Event | null>;
  findBySession(sessionId: Identity): Promise<Event[]>;
  /** Batch: todos los Events de varias Sessions en un único round-trip (evita N+1 al recorrer una Conversation con varias Sessions). */
  /**
   * Events de varias Sessions en orden cronológico ascendente. `limit` acota al
   * bloque MÁS RECIENTE (hallazgo HIGH de la auditoría santa-loop: sin cota, un
   * historial largo se traía entero a memoria para quedarse con los últimos
   * turnos, y `events` es append-only sin retención).
   */
  findBySessions(sessionIds: Identity[], limit?: number): Promise<Event[]>;
}

export interface DecisionRepository {
  save(decision: Decision): Promise<void>;
  findById(id: Identity): Promise<Decision | null>;
  findBySession(sessionId: Identity): Promise<Decision[]>;
}
