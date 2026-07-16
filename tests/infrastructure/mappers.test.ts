import { describe, expect, it } from "vitest";
import { Identity } from "@/domain";
import {
  agentToRow,
  conversationToRow,
  decisionToRow,
  eventToRow,
  funnelToRow,
  rowToAgent,
  rowToConversation,
  rowToDecision,
  rowToEvent,
  rowToFunnel,
  rowToSession,
  rowToTenant,
  sessionToRow,
  tenantToRow,
} from "@/infrastructure/supabase/mappers";
import {
  Agent,
  Conversation,
  Decision,
  Event,
  Funnel,
  Session,
  Tenant,
} from "@/domain";

const id = (v: string) => Identity.of(v);

/**
 * Tests de contrato de persistencia (offline, sin BD): garantizan que
 * entidad → fila → entidad preserva la identidad y los datos, incluyendo la
 * reconstrucción de fechas (Session.timeline, Event.occurredAt) que viajan como
 * strings ISO en JSONB. Las políticas RLS se prueban aparte contra la BD real.
 */
describe("Supabase mappers · round-trip (SSOT Regla 12)", () => {
  it("Tenant", () => {
    const t = Tenant.create(id("t1"), { name: "Acme" });
    const back = rowToTenant(tenantToRow(t));
    expect(back.id.equals(t.id)).toBe(true);
    expect(back.name).toBe("Acme");
  });

  it("Agent conserva tenantId, políticas y perfil de razonamiento", () => {
    const a = Agent.create(id("a1"), {
      tenantId: id("t1"),
      name: "Ventas",
      objective: "calificar leads",
      permanentPrompt: "eres un asistente",
      policies: [{ name: "no-precio", rule: "no revelar precios" }],
      reasoningProfile: "sales-default",
    });
    const back = rowToAgent(agentToRow(a));
    expect(back.tenantId.equals(id("t1"))).toBe(true);
    expect(back.policies).toHaveLength(1);
    expect(back.reasoningProfile).toBe("sales-default");
  });

  it("Funnel conserva etapas", () => {
    const f = Funnel.create(id("f1"), {
      tenantId: id("t1"),
      name: "Comercial",
      stages: [{ name: "TOFU", objective: "captar", transitionCriteria: "interés" }],
    });
    const back = rowToFunnel(funnelToRow(f));
    expect(back.stages).toHaveLength(1);
    expect(back.stages[0].name).toBe("TOFU");
  });

  it("Conversation conserva canal y participantes", () => {
    const c = Conversation.create(id("c1"), {
      tenantId: id("t1"),
      channel: "whatsapp",
      participants: [{ channelHandle: "+573001112233", displayName: "Ana" }],
    });
    const back = rowToConversation(conversationToRow(c));
    expect(back.channel).toBe("whatsapp");
    expect(back.participants[0].channelHandle).toBe("+573001112233");
  });

  it("Session reconstruye las fechas del timeline", () => {
    const at = new Date("2026-07-15T12:00:00.000Z");
    const s = Session.create(id("s1"), {
      conversationId: id("c1"),
      dimensions: {
        state: { status: "active", stage: "TOFU" },
        memory: { nombre: "Ana" },
        context: {},
        timeline: [{ at, kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
    const back = rowToSession(sessionToRow(s));
    expect(back.isActive).toBe(true);
    expect(back.dimensions.timeline[0].at).toBeInstanceOf(Date);
    expect(back.dimensions.timeline[0].at.toISOString()).toBe(at.toISOString());
    expect(back.state.stage).toBe("TOFU");
  });

  it("Event reconstruye occurredAt como Date", () => {
    const at = new Date("2026-07-15T12:00:00.000Z");
    const e = Event.create(id("e1"), {
      sessionId: id("s1"),
      type: "message.received",
      occurredAt: at,
      payload: { text: "hola" },
    });
    const back = rowToEvent(eventToRow(e));
    expect(back.occurredAt).toBeInstanceOf(Date);
    expect(back.occurredAt.toISOString()).toBe(at.toISOString());
    expect(back.payload.text).toBe("hola");
  });

  it("Event conserva external_id en el round-trip", () => {
    const e = Event.create(id("e9"), {
      sessionId: id("s1"),
      type: "message.received",
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      payload: { text: "hola" },
      externalId: "wamid.XYZ",
    });
    const row = eventToRow(e);
    expect(row.external_id).toBe("wamid.XYZ");
    const back = rowToEvent(row);
    expect(back.externalId).toBe("wamid.XYZ");
  });

  it("Decision conserva origen, eventId y plan de acciones", () => {
    const d = Decision.create(id("d1"), {
      sessionId: id("s1"),
      eventId: id("e1"),
      source: "deterministic-engine",
      rationale: "responder",
      actions: [{ type: "reply", params: { text: "hola" } }],
    });
    const back = rowToDecision(decisionToRow(d));
    expect(back.eventId.equals(id("e1"))).toBe(true);
    expect(back.source).toBe("deterministic-engine");
    expect(back.actions).toHaveLength(1);
  });
});
