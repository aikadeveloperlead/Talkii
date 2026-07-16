import { beforeEach, describe, expect, it } from "vitest";
import { Agent, DomainError, Identity } from "@/domain";
import {
  IngestEvent,
  MakeDecision,
  StartConversation,
} from "@/application/use-cases";
import {
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
});
