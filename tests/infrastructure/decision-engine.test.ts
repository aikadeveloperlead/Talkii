import { describe, expect, it } from "vitest";
import { Agent, Event, Funnel, Identity, Session } from "@/domain";
import type {
  ExecutionContext,
  IReasoningProvider,
  ReasoningRequest,
  ReasoningResult,
} from "@/application/ports";
import { ReasoningBackedDecisionEngine } from "@/infrastructure";
import { SequentialIds } from "../fakes";

/** Proveedor de razonamiento falso: captura la request y devuelve una salida fija. */
class FakeReasoningProvider implements IReasoningProvider {
  lastRequest?: ReasoningRequest;
  constructor(
    private readonly result: ReasoningResult = {
      output: "Hola, ¿en qué puedo ayudarte?",
      metadata: { model: "fake-model" },
    },
  ) {}
  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    this.lastRequest = request;
    return this.result;
  }
}

function buildContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  const session = Session.create(Identity.of("s1"), {
    conversationId: Identity.of("c1"),
    dimensions: {
      state: { status: "active", stage: "greeting" },
      memory: { nombre: "Ana" },
      context: {},
      timeline: [],
      variables: { intento: 1 },
      metadata: {},
    },
  });
  const event = Event.create(Identity.of("e1"), {
    sessionId: session.id,
    type: "message.received",
    occurredAt: new Date("2026-07-15T00:00:00.000Z"),
    payload: { text: "quiero información de precios" },
  });
  const agent = Agent.create(Identity.of("a1"), {
    tenantId: Identity.of("t1"),
    name: "Ventas",
    objective: "calificar leads",
    permanentPrompt: "Eres un asistente de ventas cordial.",
    policies: [{ name: "tono", rule: "siempre formal" }],
    reasoningProfile: "sales-default",
  });
  return {
    event,
    session,
    agent,
    funnel: null,
    snapshot: { state: session.state, memory: session.dimensions.memory },
    ...overrides,
  };
}

describe("ReasoningBackedDecisionEngine (AA-02: engine independiente del LLM)", () => {
  it("produce una Decision de origen ai-model derivada del Event, con Action message.send", async () => {
    const provider = new FakeReasoningProvider();
    const engine = new ReasoningBackedDecisionEngine(provider, new SequentialIds());
    const context = buildContext();

    const decision = await engine.decide(context);

    expect(decision.source).toBe("ai-model");
    expect(decision.eventId.equals(context.event.id)).toBe(true);
    expect(decision.sessionId.equals(context.session.id)).toBe(true);
    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0]).toEqual({
      type: "message.send",
      params: { text: "Hola, ¿en qué puedo ayudarte?" },
    });
    expect(decision.rationale).toContain("sales-default");
    expect(decision.rationale).toContain("model=fake-model");
  });

  it("compone las instructions con prompt, objetivo, políticas y funnel; y toma el input del payload", async () => {
    const provider = new FakeReasoningProvider();
    const engine = new ReasoningBackedDecisionEngine(provider, new SequentialIds());
    const funnel = Funnel.create(Identity.of("f1"), {
      tenantId: Identity.of("t1"),
      name: "Onboarding",
      stages: [
        { name: "Saludo", objective: "romper el hielo", transitionCriteria: "responde" },
      ],
    });

    await engine.decide(buildContext({ funnel }));

    const req = provider.lastRequest!;
    expect(req.profile).toBe("sales-default");
    expect(req.input).toBe("quiero información de precios");
    expect(req.instructions).toContain("asistente de ventas cordial");
    expect(req.instructions).toContain("Objetivo: calificar leads");
    expect(req.instructions).toContain("tono: siempre formal");
    expect(req.instructions).toContain("Funnel «Onboarding»");
  });

  it("cuando el razonamiento no produce salida, la Decision no lleva Actions", async () => {
    const provider = new FakeReasoningProvider({ output: "   ", metadata: {} });
    const engine = new ReasoningBackedDecisionEngine(provider, new SequentialIds());

    const decision = await engine.decide(buildContext());

    expect(decision.actions).toHaveLength(0);
    expect(decision.source).toBe("ai-model");
  });
});
