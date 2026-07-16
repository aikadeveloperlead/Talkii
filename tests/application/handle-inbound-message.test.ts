import { describe, expect, it } from "vitest";
import { Agent, Decision, Identity } from "@/domain";
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
});
