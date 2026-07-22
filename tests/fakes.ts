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
import { DuplicateExternalEventError } from "@/application/ports";
import type {
  AgentRepository,
  AuthGateway,
  ChannelBinding,
  ChannelBindingResolver,
  Clock,
  ConversationRepository,
  DecisionRepository,
  EventRepository,
  ExecutionContext,
  FunnelRepository,
  IDecisionEngine,
  IdGenerator,
  MessageSender,
  MessageSendResult,
  OutboundMessage,
  SessionRepository,
  TenantRepository,
} from "@/application/ports";

/** IdGenerator determinista: id-1, id-2, ... */
export class SequentialIds implements IdGenerator {
  private n = 0;
  next(): Identity {
    this.n += 1;
    return Identity.of(`id-${this.n}`);
  }
}

/** Clock fijo para tests deterministas. */
export class FixedClock implements Clock {
  constructor(private readonly fixed = new Date("2026-07-15T00:00:00.000Z")) {}
  now(): Date {
    return this.fixed;
  }
}

function makeMapRepo<T extends { id: Identity }>() {
  const store = new Map<string, T>();
  return {
    store,
    async save(entity: T): Promise<void> {
      store.set(entity.id.toString(), entity);
    },
    async findById(id: Identity): Promise<T | null> {
      return store.get(id.toString()) ?? null;
    },
  };
}

export class InMemoryTenants implements TenantRepository {
  private repo = makeMapRepo<Tenant>();
  save = this.repo.save;
  findById = this.repo.findById;
}

export class InMemoryAgents implements AgentRepository {
  private repo = makeMapRepo<Agent>();
  save = this.repo.save;
  findById = this.repo.findById;
}

export class InMemoryFunnels implements FunnelRepository {
  private repo = makeMapRepo<Funnel>();
  save = this.repo.save;
  findById = this.repo.findById;
}

export class InMemoryConversations implements ConversationRepository {
  private repo = makeMapRepo<Conversation>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null> {
    return (
      [...this.repo.store.values()].find(
        (c) =>
          c.tenantId.equals(tenantId) &&
          c.channel === channel &&
          c.participants.some((p) => p.channelHandle === handle),
      ) ?? null
    );
  }
}

export class InMemorySessions implements SessionRepository {
  private repo = makeMapRepo<Session>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findActiveByConversation(
    conversationId: Identity,
  ): Promise<Session | null> {
    return (
      [...this.repo.store.values()].find(
        (s) => s.conversationId.equals(conversationId) && s.isActive,
      ) ?? null
    );
  }
}

export class InMemoryEvents implements EventRepository {
  private store = new Map<string, Event>();
  async append(event: Event): Promise<void> {
    if (
      event.externalId &&
      [...this.store.values()].some((e) => e.externalId === event.externalId)
    ) {
      throw new DuplicateExternalEventError(event.externalId);
    }
    this.store.set(event.id.toString(), event);
  }
  async findById(id: Identity): Promise<Event | null> {
    return this.store.get(id.toString()) ?? null;
  }
  async findBySession(sessionId: Identity): Promise<Event[]> {
    return [...this.store.values()].filter((e) =>
      e.sessionId.equals(sessionId),
    );
  }
}

export class InMemoryDecisions implements DecisionRepository {
  store = new Map<string, Decision>();
  async save(decision: Decision): Promise<void> {
    this.store.set(decision.id.toString(), decision);
  }
  async findById(id: Identity): Promise<Decision | null> {
    return this.store.get(id.toString()) ?? null;
  }
  async findBySession(sessionId: Identity): Promise<Decision[]> {
    return [...this.store.values()].filter((d) =>
      d.sessionId.equals(sessionId),
    );
  }
}

/** Resolver de bindings en memoria, precargado por el test. */
export class InMemoryChannelBindings implements ChannelBindingResolver {
  constructor(private readonly bindings: ChannelBinding[] = []) {}
  async findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null> {
    return (
      this.bindings.find(
        (b) => b.channel === channel && b.externalId === externalId,
      ) ?? null
    );
  }
}

/** MessageSender falso: registra los envíos y devuelve wamids sintéticos. */
export class FakeMessageSender implements MessageSender {
  sent: OutboundMessage[] = [];
  async send(message: OutboundMessage): Promise<MessageSendResult> {
    this.sent.push(message);
    return { externalMessageId: `wamid.out-${this.sent.length}` };
  }
}

/**
 * Decision Engine deterministo para tests: produce siempre una Decision de
 * origen "deterministic-engine" derivada del Event del contexto. Verifica que
 * la aplicación funciona sin depender de ningún LLM (AA-02).
 */
export class StubDecisionEngine implements IDecisionEngine {
  constructor(private readonly ids: IdGenerator) {}
  async decide(context: ExecutionContext): Promise<Decision> {
    return Decision.create(this.ids.next(), {
      sessionId: context.session.id,
      eventId: context.event.id,
      source: "deterministic-engine",
      rationale: "stub: responder al cliente",
      actions: [{ type: "reply", params: { text: "hola" } }],
    });
  }
}

/** AuthGateway falso: registra las asignaciones; puede inyectarse para fallar. */
export class FakeAuthGateway implements AuthGateway {
  assignments: { userId: string; tenantId: string }[] = [];
  constructor(private readonly failWith?: Error) {}
  async assignTenantToUser(userId: string, tenantId: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.assignments.push({ userId, tenantId });
  }
}
