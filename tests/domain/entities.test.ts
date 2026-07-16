import { describe, expect, it } from "vitest";
import {
  Agent,
  Conversation,
  Decision,
  DomainError,
  Event,
  Funnel,
  Identity,
  Session,
  Tenant,
} from "@/domain";

const id = (v: string) => Identity.of(v);

describe("Identity", () => {
  it("rechaza strings vacíos", () => {
    expect(() => Identity.of("  ")).toThrow(DomainError);
  });

  it("igualdad por valor", () => {
    expect(id("a").equals(id("a"))).toBe(true);
    expect(id("a").equals(id("b"))).toBe(false);
  });
});

describe("Tenant (SSOT Cap.7 §4)", () => {
  it("exige nombre no vacío", () => {
    expect(() => Tenant.create(id("t1"), { name: "" })).toThrow(DomainError);
  });
});

describe("Agent (SSOT Cap.7 §5, AA-02)", () => {
  it("exige objetivo y perfil de razonamiento abstracto", () => {
    expect(() =>
      Agent.create(id("a1"), {
        tenantId: id("t1"),
        name: "Ventas",
        objective: "",
        permanentPrompt: "eres un asistente",
        policies: [],
        reasoningProfile: "sales-default",
      }),
    ).toThrow(DomainError);
  });

  it("conserva identidad independiente del proveedor (reasoningProfile abstracto)", () => {
    const agent = Agent.create(id("a1"), {
      tenantId: id("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente",
      policies: [{ name: "no-precio", rule: "no revelar precios" }],
      reasoningProfile: "sales-default",
    });
    expect(agent.reasoningProfile).toBe("sales-default");
    expect(agent.policies).toHaveLength(1);
  });
});

describe("Funnel (SSOT Cap.7 §10)", () => {
  it("exige al menos una etapa", () => {
    expect(() =>
      Funnel.create(id("f1"), { tenantId: id("t1"), name: "Comercial", stages: [] }),
    ).toThrow(DomainError);
  });
});

describe("Conversation (SSOT Cap.7 §6)", () => {
  it("exige al menos un participante", () => {
    expect(() =>
      Conversation.create(id("c1"), {
        tenantId: id("t1"),
        channel: "whatsapp",
        participants: [],
      }),
    ).toThrow(DomainError);
  });
});

describe("Event (SSOT Cap.7 §8)", () => {
  it("rechaza instante temporal inválido", () => {
    expect(() =>
      Event.create(id("e1"), {
        sessionId: id("s1"),
        type: "message.received",
        occurredAt: new Date("no-es-fecha"),
        payload: {},
      }),
    ).toThrow(DomainError);
  });
});

describe("Session (SSOT Cap.7 §7)", () => {
  it("nace activa con un único State", () => {
    const session = Session.create(id("s1"), {
      conversationId: id("c1"),
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [],
        variables: {},
        metadata: {},
      },
    });
    expect(session.isActive).toBe(true);
  });
});

describe("Decision (SSOT Cap.7 §9)", () => {
  it("exige trazabilidad (rationale no vacío)", () => {
    expect(() =>
      Decision.create(id("d1"), {
        sessionId: id("s1"),
        eventId: id("e1"),
        source: "business-rule",
        rationale: "",
        actions: [],
      }),
    ).toThrow(DomainError);
  });

  it("deriva de un único Event y conserva su origen", () => {
    const decision = Decision.create(id("d1"), {
      sessionId: id("s1"),
      eventId: id("e1"),
      source: "ai-model",
      rationale: "responder",
      actions: [{ type: "reply", params: {} }],
    });
    expect(decision.eventId.equals(id("e1"))).toBe(true);
    expect(decision.source).toBe("ai-model");
  });
});
