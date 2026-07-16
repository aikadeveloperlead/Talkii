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
import { DuplicateExternalEventError } from "@/application/ports";
import type {
  AgentRepository,
  Clock,
  ConversationRepository,
  DecisionRepository,
  EventRepository,
  ExecutionContext,
  FunnelRepository,
  IDecisionEngine,
  IdGenerator,
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
}

export class InMemorySessions implements SessionRepository {
  private repo = makeMapRepo<Session>();
  save = this.repo.save;
  findById = this.repo.findById;
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
  async findBySession(sessionId: Identity): Promise<Decision[]> {
    return [...this.store.values()].filter((d) =>
      d.sessionId.equals(sessionId),
    );
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
