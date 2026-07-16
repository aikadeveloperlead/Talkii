import type { SupabaseClient } from "@supabase/supabase-js";
import { SystemClock, UuidIdGenerator } from "@/infrastructure";
import {
  SupabaseAgentRepository,
  SupabaseConversationRepository,
  SupabaseDecisionRepository,
  SupabaseEventRepository,
  SupabaseFunnelRepository,
  SupabaseSessionRepository,
  SupabaseTenantRepository,
} from "@/infrastructure/supabase/repositories";
import { IngestEvent, MakeDecision, StartConversation } from "@/application/use-cases";
import type { IDecisionEngine } from "@/application/ports";

/**
 * Composition Root de la capa `app`: ensambla los casos de uso con sus
 * adaptadores concretos a partir de un `SupabaseClient` con alcance de request
 * (creado por `createServerSupabase`). Aquí —y solo aquí— el dominio se conecta
 * con la infraestructura; las capas internas nunca conocen estas clases.
 */
export interface Container {
  startConversation: StartConversation;
  ingestEvent: IngestEvent;
  /** Requiere un IDecisionEngine concreto (aún pendiente de implementar). */
  makeDecision(engine: IDecisionEngine): MakeDecision;
}

export function createContainer(db: SupabaseClient): Container {
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();

  const tenants = new SupabaseTenantRepository(db);
  const agents = new SupabaseAgentRepository(db);
  const funnels = new SupabaseFunnelRepository(db);
  const conversations = new SupabaseConversationRepository(db);
  const sessions = new SupabaseSessionRepository(db);
  const events = new SupabaseEventRepository(db);
  const decisions = new SupabaseDecisionRepository(db);
  void tenants; // disponible para casos de uso de aprovisionamiento (pendientes).

  return {
    startConversation: new StartConversation(ids, clock, conversations, sessions),
    ingestEvent: new IngestEvent(ids, clock, sessions, events),
    makeDecision: (engine: IDecisionEngine) =>
      new MakeDecision(engine, events, sessions, agents, funnels, decisions),
  };
}
