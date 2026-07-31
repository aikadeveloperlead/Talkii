import { describe, expect, it } from "vitest";
import {
  Agent,
  ChannelBinding,
  Conversation,
  Decision,
  DomainError,
  Identity,
  Session,
} from "@/domain";
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
  IdGenerator,
  SessionRepository,
} from "@/application/ports";
import {
  FakeMessageSender,
  FixedClock,
  InMemoryAgents,
  InMemoryChannelBindings,
  InMemoryConversations,
  InMemoryRateLimiter,
  InMemoryDecisions,
  InMemoryEvents,
  InMemoryFunnels,
  InMemorySessions,
  SequentialIds,
} from "../fakes";

/**
 * Simula la carrera de item 10 (sub-item 5/5): la primera Session.save() de
 * una Session activa "pierde" — otra request ya ganó y creó la suya (el
 * índice único parcial de 0015_sessions_one_active.sql, a nivel de
 * repositorio Supabase real, se traduce a este mismo DomainError) — las
 * llamadas siguientes se comportan con normalidad.
 */
class ConflictOnceSessions implements SessionRepository {
  private savedOnce = false;
  constructor(
    private readonly inner: InMemorySessions,
    private readonly winner: Session,
  ) {}
  async save(session: Session): Promise<void> {
    if (!this.savedOnce && session.isActive) {
      this.savedOnce = true;
      await this.inner.save(this.winner);
      throw new DomainError("Session: ya existe una Session activa para esta Conversation");
    }
    return this.inner.save(session);
  }
  findById(id: Identity) {
    return this.inner.findById(id);
  }
  findActiveByConversation(conversationId: Identity) {
    return this.inner.findActiveByConversation(conversationId);
  }
  findAllByConversation(conversationId: Identity) {
    return this.inner.findAllByConversation(conversationId);
  }
}

/** Engine determinista que produce un plan message.send (para ver el loop entero). */
class SendReplyEngine implements IDecisionEngine {
  constructor(private readonly ids: IdGenerator) {}
  async decide(context: ExecutionContext): Promise<Decision> {
    return Decision.create(this.ids.next(), {
      sessionId: context.session.id,
      eventId: context.event.id,
      source: "deterministic-engine",
      rationale: "responder al mensaje entrante",
      actions: [{ type: "message.send", params: { text: "respuesta" } }],
    });
  }
}

const binding: ChannelBinding = ChannelBinding.create(Identity.of("cb1"), {
  tenantId: Identity.of("11111111-1111-1111-1111-111111111111"),
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: Identity.of("a1"),
});

function setup(inboundLimit = { limit: 100, windowSeconds: 60 }) {
  const rateLimiter = new InMemoryRateLimiter();
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const agents = new InMemoryAgents();
  const funnels = new InMemoryFunnels();
  const conversations = new InMemoryConversations();
  const sessions = new InMemorySessions();
  const events = new InMemoryEvents();
  const decisions = new InMemoryDecisions();
  const sender = new FakeMessageSender();

  const useCase = new HandleInboundMessage(
    new InMemoryChannelBindings([binding]),
    conversations,
    sessions,
    ids,
    clock,
    new StartConversation(ids, clock, conversations, sessions),
    new IngestEvent(ids, clock, sessions, events),
    new MakeDecision(
      new SendReplyEngine(ids),
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    ),
    new ExecuteDecision(ids, clock, decisions, events, sender),
    24 * 60 * 60 * 1000, // 24h, mismo default que container.ts
    rateLimiter,
    inboundLimit,
  );

  return { agents, conversations, sessions, events, decisions, sender, useCase, rateLimiter };
}

async function seedAgent(agents: InMemoryAgents) {
  await agents.save(
    Agent.create(Identity.of("a1"), {
      tenantId: binding.tenantId,
      name: "Vendedor",
      objective: "vender",
      permanentPrompt: "sé amable",
      policies: [],
      reasoningProfile: "balanced",
    }),
  );
}

const inbound = {
  channel: "whatsapp" as const,
  channelExternalId: "phone-123",
  externalMessageId: "wamid.IN-1",
  from: "573001112233",
  displayName: "Nicolás",
  text: "hola, quiero info",
  timestamp: new Date("2026-07-15T12:00:00.000Z"),
};

describe("HandleInboundMessage (webhook → ingest → decide → ejecuta)", () => {
  it("crea Conversation+Session nuevas y responde por el sender", async () => {
    const { agents, conversations, sender, useCase } = setup();
    await seedAgent(agents);

    const result = await useCase.execute(inbound);

    expect(result.status).toBe("processed");
    const conv = await conversations.findByParticipant(
      binding.tenantId,
      "whatsapp",
      "573001112233",
    );
    expect(conv).not.toBeNull();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe("573001112233");
  });

  it("reutiliza la Conversation existente del mismo participante", async () => {
    const { agents, conversations, useCase } = setup();
    await seedAgent(agents);

    await useCase.execute(inbound);
    await useCase.execute({ ...inbound, externalMessageId: "wamid.IN-2" });

    // Sigue habiendo UNA conversación para ese handle.
    const conv = await conversations.findByParticipant(
      binding.tenantId,
      "whatsapp",
      "573001112233",
    );
    expect(conv).not.toBeNull();
  });

  it("es idempotente ante reintentos (mismo wamid → duplicate)", async () => {
    const { agents, sender, useCase } = setup();
    await seedAgent(agents);

    const first = await useCase.execute(inbound);
    const retry = await useCase.execute(inbound);

    expect(first.status).toBe("processed");
    expect(retry.status).toBe("duplicate");
    expect(sender.sent).toHaveLength(1); // no se reenvía nada
  });

  it("devuelve unbound si el phone_number_id no está registrado", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      ...inbound,
      channelExternalId: "phone-desconocido",
    });
    expect(result.status).toBe("unbound");
  });

  it("no decide ni responde si un operador tiene el control (human-controlled)", async () => {
    const { agents, conversations, sessions, sender, useCase } = setup();
    await seedAgent(agents);

    // Primer mensaje: abre Conversation+Session y responde normalmente.
    await useCase.execute(inbound);

    const conv = await conversations.findByParticipant(
      binding.tenantId,
      "whatsapp",
      "573001112233",
    );
    const active = await sessions.findActiveByConversation(conv!.id);
    await sessions.save(
      Session.create(active!.id, {
        conversationId: active!.conversationId,
        dimensions: {
          ...active!.dimensions,
          metadata: { ...active!.dimensions.metadata, operatorControl: true },
        },
      }),
    );

    const result = await useCase.execute({
      ...inbound,
      externalMessageId: "wamid.IN-2",
      text: "segundo mensaje mientras el operador interviene",
    });

    expect(result.status).toBe("human-controlled");
    expect(sender.sent).toHaveLength(1); // solo la primera respuesta automática
  });

  it("cierra la Session inactiva y abre una nueva si superó el timeout de inactividad (item MEDIO: SessionStatus=closed nunca se producía)", async () => {
    const { agents, conversations, sessions, events, decisions, sender } = setup();
    await seedAgent(agents);

    // Conversation existente con una Session activa cuya última actividad
    // fue hace mucho más que el timeout configurado.
    const conversation = Conversation.create(Identity.of("conv-1"), {
      tenantId: binding.tenantId,
      channel: "whatsapp",
      participants: [{ channelHandle: "573001112233", displayName: "Nicolás" }],
    });
    await conversations.save(conversation);
    const staleSession = Session.create(Identity.of("stale-session"), {
      conversationId: conversation.id,
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: new Date("2026-01-01T00:00:00.000Z"), kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
    await sessions.save(staleSession);

    const oneHourMs = 60 * 60 * 1000;
    const useCase = new HandleInboundMessage(
      new InMemoryChannelBindings([binding]),
      conversations,
      sessions,
      new SequentialIds(),
      new FixedClock(), // "ahora" muy posterior al 2026-01-01 de la Session stale
      new StartConversation(new SequentialIds(), new FixedClock(), conversations, sessions),
      new IngestEvent(new SequentialIds(), new FixedClock(), sessions, events),
      new MakeDecision(
        new SendReplyEngine(new SequentialIds()),
        events,
        sessions,
        agents,
        new InMemoryFunnels(),
        decisions,
        new SequentialIds(),
        new FixedClock(),
      ),
      new ExecuteDecision(new SequentialIds(), new FixedClock(), decisions, events, sender),
      oneHourMs,
      new InMemoryRateLimiter(),
      { limit: 100, windowSeconds: 60 },
    );

    const result = await useCase.execute(inbound);

    expect(result.status).toBe("processed");
    const stale = await sessions.findById(staleSession.id);
    expect(stale?.isActive).toBe(false); // cerrada, no borrada

    const active = await sessions.findActiveByConversation(conversation.id);
    expect(active).not.toBeNull();
    expect(active?.id.toString()).not.toBe("stale-session");
  });

  it("no pierde el mensaje si pierde la carrera al reabrir Session (item 10, usa la Session de quien ganó)", async () => {
    const ids = new SequentialIds();
    const clock = new FixedClock();
    const agents = new InMemoryAgents();
    const funnels = new InMemoryFunnels();
    const conversations = new InMemoryConversations();
    const realSessions = new InMemorySessions();
    const events = new InMemoryEvents();
    const decisions = new InMemoryDecisions();
    const sender = new FakeMessageSender();
    await seedAgent(agents);

    // Conversation existente cuya única Session ya está cerrada — el próximo
    // mensaje entrante entra por la rama que reabre Session (la que puede
    // perder la carrera).
    const conv = await new StartConversation(ids, clock, conversations, realSessions).execute({
      tenantId: binding.tenantId.toString(),
      channel: "whatsapp",
      participant: { channelHandle: "573001112233", displayName: "Nicolás" },
    });
    const openSession = await realSessions.findById(Identity.of(conv.sessionId));
    await realSessions.save(
      Session.create(openSession!.id, {
        conversationId: openSession!.conversationId,
        dimensions: {
          ...openSession!.dimensions,
          state: { status: "closed" },
        },
      }),
    );

    // La Session "ganadora" que otra request concurrente ya persistió.
    const winnerSession = Session.open(
      ids.next(),
      Identity.of(conv.conversationId),
      clock.now(),
    );
    const racySessions = new ConflictOnceSessions(realSessions, winnerSession);

    const useCase = new HandleInboundMessage(
      new InMemoryChannelBindings([binding]),
      conversations,
      racySessions,
      ids,
      clock,
      new StartConversation(ids, clock, conversations, racySessions),
      new IngestEvent(ids, clock, racySessions, events),
      new MakeDecision(
        new SendReplyEngine(ids),
        events,
        racySessions,
        agents,
        funnels,
        decisions,
        ids,
        clock,
      ),
      new ExecuteDecision(ids, clock, decisions, events, sender),
      24 * 60 * 60 * 1000,
      new InMemoryRateLimiter(),
      { limit: 100, windowSeconds: 60 },
    );

    const result = await useCase.execute(inbound);

    expect(result.status).toBe("processed");
    // El mensaje quedó registrado bajo la Session que ganó la carrera, no perdido.
    const eventsOnWinner = await events.findBySession(winnerSession.id);
    expect(eventsOnWinner.some((e) => e.type === "message.received")).toBe(true);
    expect(sender.sent).toHaveLength(1);
  });
});

describe("HandleInboundMessage — throttle del pipeline WhatsApp→LLM (hallazgo HIGH)", () => {
  it("registra el Event pero NO decide cuando el tenant supera su cuota", async () => {
    const { agents, conversations, decisions, sender, sessions, events, useCase } = setup({
      limit: 2,
      windowSeconds: 60,
    });
    await seedAgent(agents);

    await useCase.execute(inbound);
    await useCase.execute({ ...inbound, externalMessageId: "wamid.IN-2" });
    const third = await useCase.execute({ ...inbound, externalMessageId: "wamid.IN-3" });

    expect(third.status).toBe("rate-limited");
    // Se respondió a los 2 primeros, no al tercero: se acotó el gasto de LLM.
    expect(sender.sent).toHaveLength(2);
    expect(decisions.store.size).toBe(2);

    // Pero el mensaje del cliente NO se perdió: quedó como Event consultable,
    // igual que en el caso human-controlled.
    const conv = await conversations.findByParticipant(binding.tenantId, "whatsapp", inbound.from);
    const allSessions = await sessions.findAllByConversation(conv!.id);
    const received = (await events.findBySessions(allSessions.map((s) => s.id))).filter(
      (e) => e.type === "message.received",
    );
    expect(received).toHaveLength(3);
  });

  it("acota por tenant, no globalmente (la key incluye el tenantId)", async () => {
    const { agents, useCase, rateLimiter } = setup();
    await seedAgent(agents);

    await useCase.execute(inbound);

    expect(rateLimiter.keys[0]).toContain(binding.tenantId.toString());
  });
});
