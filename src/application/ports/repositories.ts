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
}

export interface FunnelRepository {
  save(funnel: Funnel): Promise<void>;
  findById(id: Identity): Promise<Funnel | null>;
}

export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findById(id: Identity): Promise<Conversation | null>;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: Identity): Promise<Session | null>;
}

export interface EventRepository {
  append(event: Event): Promise<void>;
  findById(id: Identity): Promise<Event | null>;
  findBySession(sessionId: Identity): Promise<Event[]>;
}

export interface DecisionRepository {
  save(decision: Decision): Promise<void>;
  findBySession(sessionId: Identity): Promise<Decision[]>;
}
