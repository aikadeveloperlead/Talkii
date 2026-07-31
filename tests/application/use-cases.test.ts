import { beforeEach, describe, expect, it } from "vitest";
import { Agent, DomainError, Identity, Session } from "@/domain";
import { ReasoningProviderError } from "@/application/ports";
import {
  IngestEvent,
  MakeDecision,
  StartConversation,
} from "@/application/use-cases";
import {
  FailingDecisionEngine,
  FixedClock,
  InMemoryAgents,
  InMemoryConversations,
  InMemoryDecisions,
  InMemoryEvents,
  InMemoryFunnels,
  InMemorySessions,
  SequentialIds,
  StubDecisionEngine,
} from "../fakes";

describe("Modelo de Ejecución end-to-end (SSOT Cap. 11)", () => {
  let ids: SequentialIds;
  let clock: FixedClock;
  let conversations: InMemoryConversations;
  let sessions: InMemorySessions;
  let events: InMemoryEvents;
  let agents: InMemoryAgents;
  let funnels: InMemoryFunnels;
  let decisions: InMemoryDecisions;

  beforeEach(() => {
    ids = new SequentialIds();
    clock = new FixedClock();
    conversations = new InMemoryConversations();
    sessions = new InMemorySessions();
    events = new InMemoryEvents();
    agents = new InMemoryAgents();
    funnels = new InMemoryFunnels();
    decisions = new InMemoryDecisions();
  });

  it("StartConversation crea Conversation + Session inicial activa (invariante ≥1 Session)", async () => {
    const useCase = new StartConversation(ids, clock, conversations, sessions);

    const result = await useCase.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233", displayName: "Ana" },
    });

    const session = await sessions.findById(Identity.of(result.sessionId));
    expect(session).not.toBeNull();
    expect(session?.isActive).toBe(true);
    expect(session?.conversationId.toString()).toBe(result.conversationId);
  });

  it("IngestEvent registra el Event sobre la Session", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "quiero información" },
    });

    const stored = await events.findById(Identity.of(eventId));
    expect(stored?.type).toBe("message.received");
    expect(stored?.sessionId.toString()).toBe(sessionId);
  });

  it("IngestEvent bumpea el Timeline de la Session (item MEDIO: SessionStatus=closed nunca se producía porque nada trackeaba actividad)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });
    const before = await sessions.findById(Identity.of(sessionId));
    expect(before?.dimensions.timeline).toHaveLength(1); // solo "session.started"

    const ingest = new IngestEvent(ids, clock, sessions, events);
    await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const after = await sessions.findById(Identity.of(sessionId));
    expect(after?.dimensions.timeline).toHaveLength(2);
    expect(after?.lastActivityAt).toEqual(clock.now());
  });

  it("IngestEvent falla si la Session no existe", async () => {
    const ingest = new IngestEvent(ids, clock, sessions, events);
    await expect(
      ingest.execute({ sessionId: "inexistente", type: "x", payload: {} }),
    ).rejects.toThrow(DomainError);
  });

  it("MakeDecision produce y persiste una Decision derivada del Event (sin LLM — AA-02)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    const { decisionId } = await makeDecision.execute({
      eventId,
      agentId: agent.id.toString(),
    });

    const stored = [...decisions.store.values()].find(
      (d) => d.id.toString() === decisionId,
    );
    expect(stored).toBeDefined();
    expect(stored?.eventId.toString()).toBe(eventId);
    expect(stored?.source).toBe("deterministic-engine");
    expect(stored?.actions).toHaveLength(1);
  });

  it("MakeDecision arma el Context con los turnos previos de la Conversation (memoria conversacional — hallazgo crítico #1 de auditoría)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });
    await ingest.execute({
      sessionId,
      type: "message.sent",
      payload: { text: "¿en qué puedo ayudarte?" },
    });
    const { eventId: currentEventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "quiero precios" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    await makeDecision.execute({ eventId: currentEventId, agentId: agent.id.toString() });

    expect(engine.lastContext?.history).toEqual([
      { sender: "customer", text: "hola", at: clock.now() },
      { sender: "agent", text: "¿en qué puedo ayudarte?", at: clock.now() },
    ]);
  });

  it("MakeDecision.buildHistory trae los Events de todas las Sessions en un único round-trip batched (mismo N+1 que ListConversationMessages, item 8)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId, conversationId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    // Conversation reabierta: segunda Session sobre la misma Conversation.
    const secondSession = Session.create(ids.next(), {
      conversationId: Identity.of(conversationId),
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: clock.now(), kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
    await sessions.save(secondSession);
    const { eventId: currentEventId } = await ingest.execute({
      sessionId: secondSession.id.toString(),
      type: "message.received",
      payload: { text: "volví" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    await makeDecision.execute({ eventId: currentEventId, agentId: agent.id.toString() });

    expect(events.findBySessionsCalls).toBe(1);
    expect(events.findBySessionCalls).toBe(0);
  });

  it("MakeDecision deja un Event 'reasoning.failed' consultable cuando el Reasoning Provider falla (item 10, silent-failure)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    const engine = new FailingDecisionEngine(new Error("timeout del proveedor"));
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    await expect(
      makeDecision.execute({ eventId, agentId: agent.id.toString() }),
    ).rejects.toThrow("timeout del proveedor");

    const sessionEvents = await events.findBySession(Identity.of(sessionId));
    const failure = sessionEvents.find((e) => e.type === "reasoning.failed");
    expect(failure).toBeDefined();
    expect(failure?.payload).toMatchObject({
      eventId,
      agentId: agent.id.toString(),
      error: "timeout del proveedor",
      errorKind: "unknown",
    });
  });

  it("MakeDecision distingue error 'auth' (permanente) de un fallo genérico en el Event 'reasoning.failed' (item BAJO #19)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    const engine = new FailingDecisionEngine(
      new ReasoningProviderError("credencial inválida", "auth"),
    );
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    await expect(
      makeDecision.execute({ eventId, agentId: agent.id.toString() }),
    ).rejects.toThrow("credencial inválida");

    const sessionEvents = await events.findBySession(Identity.of(sessionId));
    const failure = sessionEvents.find((e) => e.type === "reasoning.failed");
    expect(failure?.payload).toMatchObject({ errorKind: "auth" });
  });

  it("MakeDecision transfiere a operador sin llamar al Reasoning Provider cuando el texto contiene una transferKeyword del Agent (item 10)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "quiero hablar con un asesor humano" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
      transferKeywords: ["asesor", "humano"],
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    const { decisionId } = await makeDecision.execute({
      eventId,
      agentId: agent.id.toString(),
    });

    expect(engine.lastContext).toBeUndefined();
    const stored = [...decisions.store.values()].find((d) => d.id.toString() === decisionId);
    expect(stored?.source).toBe("business-rule");
    expect(stored?.actions).toEqual([]);
    const updatedSession = await sessions.findById(Identity.of(sessionId));
    expect(updatedSession?.operatorControl).toBe(true);
  });

  it("MakeDecision responde con welcomeMessage sin llamar al Reasoning Provider en el primer turno de la Conversation (item 10)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
      welcomeMessage: "¡Hola! Bienvenido a Talkii, ¿en qué te ayudo?",
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    const { decisionId } = await makeDecision.execute({
      eventId,
      agentId: agent.id.toString(),
    });

    expect(engine.lastContext).toBeUndefined();
    const stored = [...decisions.store.values()].find((d) => d.id.toString() === decisionId);
    expect(stored?.source).toBe("business-rule");
    expect(stored?.actions).toEqual([
      { type: "message.send", params: { text: agent.welcomeMessage } },
    ]);
  });

  it("MakeDecision NO usa welcomeMessage en turnos posteriores al primero, aunque esté configurado (item 10, guarda de regresión)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });
    await ingest.execute({
      sessionId,
      type: "message.sent",
      payload: { text: "¡Hola! Bienvenido a Talkii" },
    });
    const { eventId: secondEventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "quiero precios" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
      welcomeMessage: "¡Hola! Bienvenido a Talkii",
    });
    await agents.save(agent);

    const engine = new StubDecisionEngine(ids);
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    await makeDecision.execute({ eventId: secondEventId, agentId: agent.id.toString() });

    expect(engine.lastContext).toBeDefined();
  });

  it("MakeDecision usa fallbackMessage del Agent cuando el Reasoning Provider falla, en vez de dejar al cliente sin respuesta (item 10)", async () => {
    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
      fallbackMessage: "Estamos con dificultades técnicas, un asesor te contactará pronto.",
    });
    await agents.save(agent);

    const engine = new FailingDecisionEngine(new Error("timeout del proveedor"));
    const makeDecision = new MakeDecision(
      engine,
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    );

    const { decisionId } = await makeDecision.execute({
      eventId,
      agentId: agent.id.toString(),
    });

    const stored = [...decisions.store.values()].find((d) => d.id.toString() === decisionId);
    expect(stored?.source).toBe("business-rule");
    expect(stored?.actions).toEqual([
      { type: "message.send", params: { text: agent.fallbackMessage } },
    ]);
    // El Event de trazabilidad del fallo se sigue dejando (no se pierde la evidencia).
    const sessionEvents = await events.findBySession(Identity.of(sessionId));
    expect(sessionEvents.some((e) => e.type === "reasoning.failed")).toBe(true);
  });
});

describe("Cotas en consultas sobre tablas append-only (hallazgo HIGH santa-loop)", () => {
  it("MakeDecision.buildHistory pide un bloque acotado, no el historial entero", async () => {
    const ids = new SequentialIds();
    const clock = new FixedClock();
    const conversations = new InMemoryConversations();
    const sessions = new InMemorySessions();
    const events = new InMemoryEvents();
    const agents = new InMemoryAgents();
    const funnels = new InMemoryFunnels();
    const decisions = new InMemoryDecisions();

    const start = new StartConversation(ids, clock, conversations, sessions);
    const { sessionId } = await start.execute({
      tenantId: "t1",
      channel: "whatsapp",
      participant: { channelHandle: "+573001112233" },
    });

    const ingest = new IngestEvent(ids, clock, sessions, events);
    const { eventId } = await ingest.execute({
      sessionId,
      type: "message.received",
      payload: { text: "hola" },
    });

    const agent = Agent.create(ids.next(), {
      tenantId: Identity.of("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente de ventas",
      policies: [],
      reasoningProfile: "sales-default",
    });
    await agents.save(agent);

    await new MakeDecision(
      new StubDecisionEngine(ids),
      events,
      sessions,
      agents,
      funnels,
      decisions,
      ids,
      clock,
    ).execute({ eventId, agentId: agent.id.toString() });

    // Antes se llamaba sin límite (undefined) y se descartaba casi todo en JS.
    expect(events.lastFindBySessionsLimit).toBeGreaterThan(0);
    expect(events.lastFindBySessionsLimit).toBeLessThanOrEqual(100);
  });
});
