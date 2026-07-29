import {
  Agent,
  Appointment,
  AppointmentTimelineEntry,
  Calendar,
  Category,
  Conversation,
  Customer,
  CustomerTimelineEntry,
  Decision,
  Event,
  Funnel,
  Identity,
  KnowledgeDocument,
  Lead,
  Session,
  Tenant,
  WhatsAppTemplate,
  type Channel,
} from "@/domain";
import { DuplicateExternalEventError } from "@/application/ports";
import type {
  AgentRepository,
  AppointmentRepository,
  AppointmentSearchFilters,
  AppointmentTimelineRepository,
  AuthGateway,
  CalendarRepository,
  ChannelBinding,
  ChannelBindingResolver,
  Clock,
  ConversationRepository,
  CustomerRepository,
  CustomerSearchFilters,
  CustomerSearchResult,
  CustomerTimelineRepository,
  DashboardKpis,
  DecisionRepository,
  EventRepository,
  ExecutionContext,
  FunnelRepository,
  IDecisionEngine,
  IdGenerator,
  LeadRepository,
  AgentKnowledgeRepository,
  CategoryRepository,
  KnowledgeRepository,
  MessageSender,
  MessageSendResult,
  OutboundMessage,
  ReportsRepository,
  SessionRepository,
  TemplateRepository,
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
  async findByName(tenantId: Identity, name: string): Promise<Agent | null> {
    return (
      [...this.repo.store.values()].find(
        (a) => a.tenantId.equals(tenantId) && a.name === name,
      ) ?? null
    );
  }
  async listByTenant(tenantId: Identity): Promise<Agent[]> {
    return [...this.repo.store.values()].filter((a) => a.tenantId.equals(tenantId));
  }
}

export class InMemoryFunnels implements FunnelRepository {
  private repo = makeMapRepo<Funnel>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findByName(tenantId: Identity, name: string): Promise<Funnel | null> {
    return (
      [...this.repo.store.values()].find(
        (f) => f.tenantId.equals(tenantId) && f.name === name,
      ) ?? null
    );
  }
  async listByTenant(tenantId: Identity): Promise<Funnel[]> {
    return [...this.repo.store.values()].filter((f) => f.tenantId.equals(tenantId));
  }
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
  async findAllByConversation(conversationId: Identity): Promise<Session[]> {
    return [...this.repo.store.values()].filter((s) =>
      s.conversationId.equals(conversationId),
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
  async findByTenant(
    tenantId: string,
    channel: Channel,
  ): Promise<ChannelBinding | null> {
    return (
      this.bindings.find(
        (b) => b.tenantId === tenantId && b.channel === channel,
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

/** AuthGateway falso: registra las asignaciones y altas; puede inyectarse para fallar. */
export class FakeAuthGateway implements AuthGateway {
  assignments: { userId: string; tenantId: string }[] = [];
  createdUsers: { email: string; password: string }[] = [];
  constructor(
    private readonly failWith?: Error,
    private readonly createUserResult: { userId: string } = {
      userId: "user-created-1",
    },
  ) {}
  async assignTenantToUser(userId: string, tenantId: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.assignments.push({ userId, tenantId });
  }
  async createConfirmedUser(
    email: string,
    password: string,
  ): Promise<{ userId: string }> {
    if (this.failWith) throw this.failWith;
    this.createdUsers.push({ email, password });
    return this.createUserResult;
  }
}

// ── CRM (SCR-003) ──
export class InMemoryCustomers implements CustomerRepository {
  private repo = makeMapRepo<Customer>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findByPhone(tenantId: Identity, phone: string): Promise<Customer | null> {
    return (
      [...this.repo.store.values()].find(
        (c) => c.tenantId.equals(tenantId) && c.phone === phone,
      ) ?? null
    );
  }
  async search(
    tenantId: Identity,
    filters: CustomerSearchFilters,
    page: number,
    limit: number,
  ): Promise<CustomerSearchResult> {
    let items = [...this.repo.store.values()].filter((c) => c.tenantId.equals(tenantId));
    if (!filters.includeArchived) items = items.filter((c) => !c.isArchived);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q),
      );
    }
    if (filters.tags?.length) {
      items = items.filter((c) => filters.tags!.every((t) => c.tags.includes(t)));
    }
    const total = items.length;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total };
  }
}

export class InMemoryLeads implements LeadRepository {
  private repo = makeMapRepo<Lead>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findByCustomerId(customerId: Identity): Promise<Lead | null> {
    return (
      [...this.repo.store.values()].find((l) => l.customerId.equals(customerId)) ?? null
    );
  }
}

export class InMemoryCustomerTimeline implements CustomerTimelineRepository {
  store = new Map<string, CustomerTimelineEntry>();
  async append(entry: CustomerTimelineEntry): Promise<void> {
    this.store.set(entry.id.toString(), entry);
  }
  async findByCustomer(customerId: Identity): Promise<CustomerTimelineEntry[]> {
    return [...this.store.values()].filter((e) => e.customerId.equals(customerId));
  }
}

// ── Scheduling (SCR-004) ──
export class InMemoryCalendars implements CalendarRepository {
  private repo = makeMapRepo<Calendar>();
  save = this.repo.save;
  findById = this.repo.findById;
  async listByTenant(tenantId: Identity): Promise<Calendar[]> {
    return [...this.repo.store.values()].filter((c) => c.tenantId.equals(tenantId));
  }
}

export class InMemoryAppointments implements AppointmentRepository {
  private repo = makeMapRepo<Appointment>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findOverlapping(
    calendarId: Identity,
    startsAt: Date,
    endsAt: Date,
    excludeId?: Identity,
  ): Promise<Appointment[]> {
    return [...this.repo.store.values()].filter(
      (a) =>
        a.calendarId.equals(calendarId) &&
        !a.isDeleted &&
        a.status !== "cancelled" &&
        !(excludeId && a.id.equals(excludeId)) &&
        a.overlaps(startsAt, endsAt),
    );
  }
  async search(
    tenantId: Identity,
    filters: AppointmentSearchFilters,
    page: number,
    limit: number,
  ): Promise<{ items: Appointment[]; total: number }> {
    let items = [...this.repo.store.values()].filter(
      (a) => a.tenantId.equals(tenantId) && !a.isDeleted,
    );
    if (filters.calendarId) items = items.filter((a) => a.calendarId.equals(filters.calendarId!));
    if (filters.customerId)
      items = items.filter((a) => a.customerId?.equals(filters.customerId!));
    if (filters.status) items = items.filter((a) => a.status === filters.status);
    const total = items.length;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total };
  }
}

export class InMemoryAppointmentTimeline implements AppointmentTimelineRepository {
  store = new Map<string, AppointmentTimelineEntry>();
  async append(entry: AppointmentTimelineEntry): Promise<void> {
    this.store.set(entry.id.toString(), entry);
  }
  async findByAppointment(appointmentId: Identity): Promise<AppointmentTimelineEntry[]> {
    return [...this.store.values()].filter((e) => e.appointmentId.equals(appointmentId));
  }
}

// ── Reports (SCR-005) — fake configurable directamente con el resultado esperado. ──
export class FakeReports implements ReportsRepository {
  constructor(
    private readonly kpis: DashboardKpis = {
      conversationCount: 0,
      activeSessionCount: 0,
      customerCount: 0,
      appointmentCount: 0,
      leadCount: 0,
      wonLeadCount: 0,
    },
    private readonly leadsByStatus: Record<string, number> = {},
    private readonly appointmentsByStatus: Record<string, number> = {},
    private readonly conversationSummary: { total: number; activeSessions: number } = {
      total: 0,
      activeSessions: 0,
    },
  ) {}
  async getDashboardKpis(): Promise<DashboardKpis> {
    return this.kpis;
  }
  async getLeadsByStatus(): Promise<Record<string, number>> {
    return this.leadsByStatus;
  }
  async getAppointmentsByStatus(): Promise<Record<string, number>> {
    return this.appointmentsByStatus;
  }
  async getConversationSummary(): Promise<{ total: number; activeSessions: number }> {
    return this.conversationSummary;
  }
}

// ── Templates (SCR-006) ──
export class InMemoryTemplates implements TemplateRepository {
  private repo = makeMapRepo<WhatsAppTemplate>();
  save = this.repo.save;
  findById = this.repo.findById;
  async listByTenant(tenantId: Identity, includeArchived = false): Promise<WhatsAppTemplate[]> {
    return [...this.repo.store.values()].filter(
      (t) => t.tenantId.equals(tenantId) && (includeArchived || !t.isArchived),
    );
  }
}

// ── Knowledge (SCR-009) ──
export class InMemoryCategories implements CategoryRepository {
  private repo = makeMapRepo<Category>();
  save = this.repo.save;
  findById = this.repo.findById;
  async listByTenant(tenantId: Identity): Promise<Category[]> {
    return [...this.repo.store.values()].filter((c) => c.tenantId.equals(tenantId));
  }
  async delete(id: Identity): Promise<void> {
    this.repo.store.delete(id.toString());
  }
}

export class InMemoryKnowledge implements KnowledgeRepository {
  private repo = makeMapRepo<KnowledgeDocument>();
  save = this.repo.save;
  findById = this.repo.findById;
  async listByTenant(tenantId: Identity, includeArchived = false): Promise<KnowledgeDocument[]> {
    return [...this.repo.store.values()].filter(
      (d) => d.tenantId.equals(tenantId) && (includeArchived || d.status !== "archived"),
    );
  }
}

export class InMemoryAgentKnowledge implements AgentKnowledgeRepository {
  links: { agentId: Identity; knowledgeId: Identity }[] = [];
  async link(agentId: Identity, knowledgeId: Identity): Promise<void> {
    if (!this.links.some((l) => l.agentId.equals(agentId) && l.knowledgeId.equals(knowledgeId))) {
      this.links.push({ agentId, knowledgeId });
    }
  }
  async unlink(agentId: Identity, knowledgeId: Identity): Promise<void> {
    this.links = this.links.filter(
      (l) => !(l.agentId.equals(agentId) && l.knowledgeId.equals(knowledgeId)),
    );
  }
  async listByAgent(agentId: Identity): Promise<Identity[]> {
    return this.links.filter((l) => l.agentId.equals(agentId)).map((l) => l.knowledgeId);
  }
}
