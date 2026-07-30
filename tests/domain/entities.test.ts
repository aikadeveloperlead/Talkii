import { describe, expect, it } from "vitest";
import {
  Agent,
  Appointment,
  ChannelBinding,
  Conversation,
  Customer,
  CustomerTimelineEntry,
  Decision,
  DomainError,
  Event,
  Funnel,
  Identity,
  Lead,
  Preferences,
  Session,
  Tenant,
  WhatsAppTemplate,
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

  it("open(conversationId, startedAt) encapsula el estado inicial (evita duplicar la construcción a mano en cada caso de uso)", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const session = Session.open(id("s1"), id("c1"), startedAt);

    expect(session.isActive).toBe(true);
    expect(session.dimensions.timeline).toEqual([{ at: startedAt, kind: "session.started" }]);
    expect(session.dimensions.memory).toEqual({});
    expect(session.dimensions.metadata).toEqual({});
  });

  it("operatorControl es un getter tipado (boolean), no un acceso crudo a metadata[unknown]", () => {
    const session = Session.open(id("s1"), id("c1"), new Date("2026-01-01T00:00:00.000Z"));
    expect(session.operatorControl).toBe(false);

    const underControl = session.withOperatorControl(true);
    expect(underControl.operatorControl).toBe(true);

    const released = underControl.withOperatorControl(false);
    expect(released.operatorControl).toBe(false);
  });

  it("close(at) transiciona a closed sin tocar el resto de las dimensiones (item MEDIO: SessionStatus=closed nunca se producía)", () => {
    const session = Session.open(id("s1"), id("c1"), new Date("2026-01-01T00:00:00.000Z"));
    const closedAt = new Date("2026-01-02T00:00:00.000Z");

    const closed = session.close(closedAt);

    expect(closed.isActive).toBe(false);
    expect(closed.state.status).toBe("closed");
    expect(closed.dimensions.memory).toEqual(session.dimensions.memory);
  });

  it("withTimelineEntry agrega una entrada y lastActivityAt refleja la más reciente", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const session = Session.open(id("s1"), id("c1"), startedAt);
    expect(session.lastActivityAt).toEqual(startedAt);

    const laterAt = new Date("2026-01-01T05:00:00.000Z");
    const touched = session.withTimelineEntry({ at: laterAt, kind: "message.received" });

    expect(touched.dimensions.timeline).toHaveLength(2);
    expect(touched.lastActivityAt).toEqual(laterAt);
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

describe("Customer (SCR-003, bounded context CRM)", () => {
  it("exige nombre no vacío", () => {
    expect(() =>
      Customer.create(id("cu1"), {
        tenantId: id("t1"),
        firstName: "",
        phone: "573001112233",
        tags: [],
      }),
    ).toThrow(DomainError);
  });

  it("exige al menos un teléfono o un correo", () => {
    expect(() =>
      Customer.create(id("cu1"), {
        tenantId: id("t1"),
        firstName: "Nicolás",
        tags: [],
      }),
    ).toThrow(DomainError);
  });

  it("withUpdatedProfile/withTags/archived reconstruyen preservando invariantes", () => {
    const customer = Customer.create(id("cu1"), {
      tenantId: id("t1"),
      firstName: "Nicolás",
      phone: "573001112233",
      tags: [],
    });

    const updated = customer.withUpdatedProfile({ company: "Aika" });
    expect(updated.company).toBe("Aika");
    expect(updated.phone).toBe("573001112233");

    const tagged = updated.withTags(["vip", "demo"]);
    expect(tagged.tags).toEqual(["vip", "demo"]);

    const fixedDate = new Date("2026-01-01T00:00:00.000Z");
    const archived = tagged.archived(fixedDate);
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedAt).toEqual(fixedDate);
  });
});

describe("Appointment (SCR-004, bounded context Scheduling)", () => {
  it("deleted(at) recibe el instante en vez de leer el reloj del sistema", () => {
    const appointment = Appointment.create(id("ap1"), {
      tenantId: id("t1"),
      calendarId: id("cal1"),
      title: "Demo",
      status: "scheduled",
      timezone: "America/Bogota",
      startsAt: new Date("2026-01-01T10:00:00.000Z"),
      endsAt: new Date("2026-01-01T11:00:00.000Z"),
    });

    const fixedDate = new Date("2026-01-02T00:00:00.000Z");
    const deleted = appointment.deleted(fixedDate);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt).toEqual(fixedDate);
  });
});

describe("WhatsAppTemplate (SCR-006)", () => {
  it("archived(at) recibe el instante en vez de leer el reloj del sistema", () => {
    const template = WhatsAppTemplate.create(id("tpl1"), {
      tenantId: id("t1"),
      name: "Bienvenida",
      language: "es",
      category: "MARKETING",
      components: { body: "Hola" as string, buttons: [] },
      status: "draft",
      version: 1,
    });

    const fixedDate = new Date("2026-01-03T00:00:00.000Z");
    const archived = template.archived(fixedDate);
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedAt).toEqual(fixedDate);
  });
});

describe("Lead (SCR-003)", () => {
  it("rechaza score negativo", () => {
    expect(() =>
      Lead.create(id("l1"), {
        customerId: id("cu1"),
        status: "new",
        score: -1,
      }),
    ).toThrow(DomainError);
  });

  it("withStatus/withScore reconstruyen el Lead", () => {
    const lead = Lead.create(id("l1"), {
      customerId: id("cu1"),
      status: "new",
      score: 0,
    });
    const qualified = lead.withStatus("qualified").withScore(80);
    expect(qualified.status).toBe("qualified");
    expect(qualified.score).toBe(80);
  });
});

describe("CustomerTimelineEntry (SCR-003)", () => {
  it("exige un tipo declarado", () => {
    expect(() =>
      CustomerTimelineEntry.create(id("ct1"), {
        customerId: id("cu1"),
        type: "",
        payload: {},
        occurredAt: new Date(),
      }),
    ).toThrow(DomainError);
  });
});

describe("Preferences (SCR-012 §5.5)", () => {
  it("rechaza language vacío", () => {
    expect(() =>
      Preferences.create(id("p1"), { tenantId: id("t1"), language: "" }),
    ).toThrow(DomainError);
  });

  it("rechaza timezone vacío", () => {
    expect(() =>
      Preferences.create(id("p1"), { tenantId: id("t1"), timezone: "  " }),
    ).toThrow(DomainError);
  });

  it("rechaza currency vacío", () => {
    expect(() =>
      Preferences.create(id("p1"), { tenantId: id("t1"), currency: "" }),
    ).toThrow(DomainError);
  });

  it("rechaza dateFormat vacío", () => {
    expect(() =>
      Preferences.create(id("p1"), { tenantId: id("t1"), dateFormat: "" }),
    ).toThrow(DomainError);
  });
});

describe("ChannelBinding (SCR-002 Channel:WhatsApp, item MEDIO #2)", () => {
  it("rechaza externalId vacío", () => {
    expect(() =>
      ChannelBinding.create(id("cb1"), {
        tenantId: id("t1"),
        channel: "whatsapp",
        externalId: "  ",
        agentId: id("a1"),
      }),
    ).toThrow(DomainError);
  });

  it("conserva identidad y campos opcionales", () => {
    const binding = ChannelBinding.create(id("cb1"), {
      tenantId: id("t1"),
      channel: "whatsapp",
      externalId: " 123456 ",
      agentId: id("a1"),
      funnelId: id("f1"),
      accessToken: "token-secreto",
    });
    expect(binding.externalId).toBe("123456");
    expect(binding.tenantId.equals(id("t1"))).toBe(true);
    expect(binding.agentId.equals(id("a1"))).toBe(true);
    expect(binding.funnelId?.equals(id("f1"))).toBe(true);
    expect(binding.accessToken).toBe("token-secreto");
  });

  it("funnelId y accessToken son opcionales", () => {
    const binding = ChannelBinding.create(id("cb1"), {
      tenantId: id("t1"),
      channel: "whatsapp",
      externalId: "123456",
      agentId: id("a1"),
    });
    expect(binding.funnelId).toBeUndefined();
    expect(binding.accessToken).toBeUndefined();
  });
});
