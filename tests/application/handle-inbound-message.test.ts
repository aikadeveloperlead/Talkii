import { describe, expect, it } from "vitest";
import { Agent, Decision, DomainError, Identity, Session } from "@/domain";
import {
  ExecuteDecision,
  HandleInboundMessage,
  IngestEvent,
  MakeDecision,
  StartConversation,
} from "@/application/use-cases";
import type {
  ChannelBinding,
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

const binding: ChannelBinding = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: "a1",
};

function setup() {
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
  );

  return { agents, conversations, sessions, events, decisions, sender, useCase };
}

async function seedAgent(agents: InMemoryAgents) {
  await agents.save(
    Agent.create(Identity.of("a1"), {
      tenantId: Identity.of(binding.tenantId),
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
      Identity.of(binding.tenantId),
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
      Identity.of(binding.tenantId),
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
      Identity.of(binding.tenantId),
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
      tenantId: binding.tenantId,
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
    );

    const result = await useCase.execute(inbound);

    expect(result.status).toBe("processed");
    // El mensaje quedó registrado bajo la Session que ganó la carrera, no perdido.
    const eventsOnWinner = await events.findBySession(winnerSession.id);
    expect(eventsOnWinner.some((e) => e.type === "message.received")).toBe(true);
    expect(sender.sent).toHaveLength(1);
  });
});
