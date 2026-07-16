import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AnthropicReasoningProvider,
  ReasoningBackedDecisionEngine,
  SupabaseChannelBindingResolver,
  SystemClock,
  UuidIdGenerator,
  WhatsAppMessageSender,
} from "@/infrastructure";
import {
  SupabaseAgentRepository,
  SupabaseConversationRepository,
  SupabaseDecisionRepository,
  SupabaseEventRepository,
  SupabaseFunnelRepository,
  SupabaseSessionRepository,
  SupabaseTenantRepository,
} from "@/infrastructure/supabase/repositories";
import {
  ExecuteDecision,
  HandleInboundMessage,
  IngestEvent,
  MakeDecision,
  StartConversation,
} from "@/application/use-cases";
import type {
  ExecutionContext,
  IDecisionEngine,
  MessageSender,
} from "@/application/ports";

/**
 * Composition Root de la capa `app`: ensambla los casos de uso con sus
 * adaptadores concretos a partir de un `SupabaseClient` con alcance de request
 * (creado por `createServerSupabase`). Aquí —y solo aquí— el dominio se conecta
 * con la infraestructura; las capas internas nunca conocen estas clases.
 */
export interface Container {
  startConversation: StartConversation;
  ingestEvent: IngestEvent;
  makeDecision: MakeDecision;
  executeDecision: ExecuteDecision;
  handleInboundMessage: HandleInboundMessage;
}

export interface ContainerOptions {
  /**
   * Permite inyectar un Decision Engine (p. ej. determinista en tests). Si se
   * omite, se usa el engine respaldado por razonamiento Anthropic, construido de
   * forma perezosa (AA-02: el origen de la decisión es intercambiable).
   */
  decisionEngine?: IDecisionEngine;
  /** Permite inyectar un sender falso en tests; por defecto WhatsApp Cloud API. */
  messageSender?: MessageSender;
}

export function createContainer(db: SupabaseClient, options: ContainerOptions = {}): Container {
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

  // El proveedor Anthropic exige ANTHROPIC_API_KEY; se construye solo al primer
  // `decide` para que montar el container no dependa de esa clave.
  const engine =
    options.decisionEngine ??
    lazyDecisionEngine(
      () => new ReasoningBackedDecisionEngine(new AnthropicReasoningProvider(), ids),
    );

  const bindings = new SupabaseChannelBindingResolver(db);
  const sender = options.messageSender ?? new WhatsAppMessageSender();

  const startConversation = new StartConversation(ids, clock, conversations, sessions);
  const ingestEvent = new IngestEvent(ids, clock, sessions, events);
  const makeDecision = new MakeDecision(engine, events, sessions, agents, funnels, decisions);
  const executeDecision = new ExecuteDecision(ids, clock, decisions, events, sender);

  return {
    startConversation,
    ingestEvent,
    makeDecision,
    executeDecision,
    handleInboundMessage: new HandleInboundMessage(
      bindings,
      conversations,
      sessions,
      ids,
      clock,
      startConversation,
      ingestEvent,
      makeDecision,
      executeDecision,
    ),
  };
}

/** Envuelve un IDecisionEngine cuya construcción se difiere al primer `decide`. */
function lazyDecisionEngine(factory: () => IDecisionEngine): IDecisionEngine {
  let inner: IDecisionEngine | undefined;
  return {
    decide(context: ExecutionContext) {
      inner ??= factory();
      return inner.decide(context);
    },
  };
}
