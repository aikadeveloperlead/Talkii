import { describe, expect, it } from "vitest";
import { Decision, Identity } from "@/domain";
import { ExecuteDecision } from "@/application/use-cases";
import type { ChannelBinding } from "@/application/ports";
import {
  FakeMessageSender,
  FixedClock,
  InMemoryDecisions,
  InMemoryEvents,
  SequentialIds,
} from "../fakes";

const binding: ChannelBinding = {
  tenantId: "t1",
  channel: "whatsapp",
  externalId: "123456",
  agentId: "a1",
};

function setup() {
  const decisions = new InMemoryDecisions();
  const events = new InMemoryEvents();
  const sender = new FakeMessageSender();
  const useCase = new ExecuteDecision(
    new SequentialIds(),
    new FixedClock(),
    decisions,
    events,
    sender,
  );
  return { decisions, events, sender, useCase };
}

describe("ExecuteDecision (SSOT Cap. 11 §14 — materializa el plan, no decide)", () => {
  it("ejecuta message.send por el puerto y registra Event message.sent", async () => {
    const { decisions, events, sender, useCase } = setup();
    await decisions.save(
      Decision.create(Identity.of("d1"), {
        sessionId: Identity.of("s1"),
        eventId: Identity.of("e1"),
        source: "ai-model",
        rationale: "responder al cliente",
        actions: [{ type: "message.send", params: { text: "¡Hola!" } }],
      }),
    );

    const result = await useCase.execute({
      decisionId: "d1",
      binding,
      to: "573001112233",
    });

    expect(result.executedActions).toBe(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe("573001112233");
    expect(sender.sent[0].text).toBe("¡Hola!");
    const sessionEvents = await events.findBySession(Identity.of("s1"));
    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0].type).toBe("message.sent");
    expect(sessionEvents[0].payload.externalMessageId).toBe("wamid.out-1");
  });

  it("omite actions de tipo desconocido sin fallar", async () => {
    const { decisions, sender, useCase } = setup();
    await decisions.save(
      Decision.create(Identity.of("d2"), {
        sessionId: Identity.of("s1"),
        eventId: Identity.of("e1"),
        source: "ai-model",
        rationale: "plan mixto",
        actions: [
          { type: "crm.update", params: {} },
          { type: "message.send", params: { text: "ok" } },
        ],
      }),
    );

    const result = await useCase.execute({ decisionId: "d2", binding, to: "57300" });

    expect(result.executedActions).toBe(1);
    expect(sender.sent).toHaveLength(1);
  });

  it("falla si la Decision no existe", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ decisionId: "nope", binding, to: "57300" }),
    ).rejects.toThrow("ExecuteDecision: la Decision no existe");
  });
});
