import { beforeEach, describe, expect, it } from "vitest";
import { Conversation, Decision, Event, Identity, Session } from "@/domain";
import {
  ExecuteDecision,
  GetConversationDetail,
  IngestEvent,
  ListConversationMessages,
  SendOperatorMessage,
  SetOperatorControl,
} from "@/application/use-cases";
import { DomainError } from "@/domain";
import type { ChannelBinding } from "@/application/ports";
import {
  FakeMessageSender,
  FixedClock,
  InMemoryChannelBindings,
  InMemoryConversations,
  InMemoryDecisions,
  InMemoryEvents,
  InMemorySessions,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";
const binding: ChannelBinding = {
  tenantId,
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: "a1",
};

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const conversations = new InMemoryConversations();
  const sessions = new InMemorySessions();
  const events = new InMemoryEvents();
  const decisions = new InMemoryDecisions();
  const sender = new FakeMessageSender();
  const bindings = new InMemoryChannelBindings([binding]);
  const ingestEvent = new IngestEvent(ids, clock, sessions, events);
  const executeDecision = new ExecuteDecision(ids, clock, decisions, events, sender);

  return {
    ids,
    clock,
    conversations,
    sessions,
    events,
    decisions,
    sender,
    bindings,
    getDetail: new GetConversationDetail(conversations, sessions),
    listMessages: new ListConversationMessages(conversations, sessions, events),
    setOperatorControl: new SetOperatorControl(sessions),
    sendOperatorMessage: new SendOperatorMessage(
      ids,
      conversations,
      sessions,
      bindings,
      ingestEvent,
      decisions,
      executeDecision,
    ),
  };
}

async function seedConversation(
  conversations: InMemoryConversations,
  sessions: InMemorySessions,
  ids: SequentialIds,
  clock: FixedClock,
) {
  const conversation = Conversation.create(ids.next(), {
    tenantId: Identity.of(tenantId),
    channel: "whatsapp",
    participants: [{ channelHandle: "573001112233", displayName: "Nicolás" }],
  });
  await conversations.save(conversation);

  const session = Session.create(ids.next(), {
    conversationId: conversation.id,
    dimensions: {
      state: { status: "active" },
      memory: {},
      context: {},
      timeline: [{ at: clock.now(), kind: "session.started" }],
      variables: {},
      metadata: {},
    },
  });
  await sessions.save(session);

  return { conversation, session };
}

describe("GetConversationDetail", () => {
  it("devuelve conversación + participante + sesión activa", async () => {
    const { conversations, sessions, ids, clock, getDetail } = setup();
    const { conversation, session } = await seedConversation(
      conversations,
      sessions,
      ids,
      clock,
    );

    const detail = await getDetail.execute(conversation.id.toString());

    expect(detail?.channel).toBe("whatsapp");
    expect(detail?.participant.channelHandle).toBe("573001112233");
    expect(detail?.session?.id).toBe(session.id.toString());
    expect(detail?.session?.operatorControl).toBe(false);
  });

  it("devuelve null si la Conversation no existe", async () => {
    const { getDetail } = setup();
    expect(await getDetail.execute("no-existe")).toBeNull();
  });
});

describe("ListConversationMessages", () => {
  it("reconstruye mensajes entrantes y salientes desde los Events, en orden cronológico", async () => {
    const { conversations, sessions, events, ids, clock, listMessages } = setup();
    const { conversation, session } = await seedConversation(
      conversations,
      sessions,
      ids,
      clock,
    );

    await events.append(
      Event.create(ids.next(), {
        sessionId: session.id,
        type: "message.received",
        occurredAt: new Date("2026-07-15T12:00:00.000Z"),
        payload: { text: "hola" },
      }),
    );
    await events.append(
      Event.create(ids.next(), {
        sessionId: session.id,
        type: "message.sent",
        occurredAt: new Date("2026-07-15T12:00:05.000Z"),
        payload: { text: "hola, ¿en qué te ayudo?" },
      }),
    );
    // Un Event que no es mensaje (p. ej. el marcador de intención del operador)
    // no debe aparecer en la lista.
    await events.append(
      Event.create(ids.next(), {
        sessionId: session.id,
        type: "operator.message.composed",
        occurredAt: new Date("2026-07-15T12:00:03.000Z"),
        payload: { text: "borrador interno" },
      }),
    );

    const messages = await listMessages.execute(conversation.id.toString());

    expect(messages).toHaveLength(2);
    expect(messages?.[0]).toMatchObject({ sender: "customer", text: "hola" });
    expect(messages?.[1]).toMatchObject({
      sender: "agent",
      text: "hola, ¿en qué te ayudo?",
    });
  });

  it("devuelve null si la Conversation no existe", async () => {
    const { listMessages } = setup();
    expect(await listMessages.execute("no-existe")).toBeNull();
  });
});

describe("SetOperatorControl", () => {
  it("activa y desactiva el control humano sobre la Session activa", async () => {
    const { conversations, sessions, ids, clock, setOperatorControl, getDetail } =
      setup();
    const { conversation } = await seedConversation(conversations, sessions, ids, clock);

    await setOperatorControl.execute({
      conversationId: conversation.id.toString(),
      enabled: true,
    });
    expect(
      (await getDetail.execute(conversation.id.toString()))?.session?.operatorControl,
    ).toBe(true);

    await setOperatorControl.execute({
      conversationId: conversation.id.toString(),
      enabled: false,
    });
    expect(
      (await getDetail.execute(conversation.id.toString()))?.session?.operatorControl,
    ).toBe(false);
  });

  it("falla si no hay Session activa", async () => {
    const { setOperatorControl } = setup();
    await expect(
      setOperatorControl.execute({ conversationId: "no-existe", enabled: true }),
    ).rejects.toThrow(DomainError);
  });
});

describe("SendOperatorMessage", () => {
  it("registra el mensaje del operador como Decision fuente=human y lo envía", async () => {
    const { conversations, sessions, ids, clock, sender, sendOperatorMessage } =
      setup();
    const { conversation } = await seedConversation(conversations, sessions, ids, clock);

    const result = await sendOperatorMessage.execute({
      conversationId: conversation.id.toString(),
      text: "un operador humano responde",
    });

    expect(result.decisionId).toBeTruthy();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({
      to: "573001112233",
      text: "un operador humano responde",
    });
  });

  it("falla si no hay ChannelBinding para el Tenant", async () => {
    const { conversations, sessions, ids, clock, bindings } = setup();
    // Tenant sin binding registrado.
    const conversation = Conversation.create(ids.next(), {
      tenantId: Identity.of("22222222-2222-2222-2222-222222222222"),
      channel: "whatsapp",
      participants: [{ channelHandle: "573000000000" }],
    });
    await conversations.save(conversation);
    const session = Session.create(ids.next(), {
      conversationId: conversation.id,
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: clock.now(), kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
    await sessions.save(session);

    const events = new InMemoryEvents();
    const decisions = new InMemoryDecisions();
    const useCase = new SendOperatorMessage(
      ids,
      conversations,
      sessions,
      bindings,
      new IngestEvent(ids, clock, sessions, events),
      decisions,
      new ExecuteDecision(ids, clock, decisions, events, new FakeMessageSender()),
    );

    await expect(
      useCase.execute({ conversationId: conversation.id.toString(), text: "hola" }),
    ).rejects.toThrow(DomainError);
  });
});
