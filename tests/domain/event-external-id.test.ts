import { describe, expect, it } from "vitest";
import { Event, Identity } from "@/domain";

describe("Event · externalId (identidad del hecho en el sistema origen)", () => {
  it("conserva el externalId cuando se provee", () => {
    const e = Event.create(Identity.of("e1"), {
      sessionId: Identity.of("s1"),
      type: "message.received",
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      payload: { text: "hola" },
      externalId: "wamid.ABC123",
    });
    expect(e.externalId).toBe("wamid.ABC123");
  });

  it("es undefined cuando no se provee (hechos internos)", () => {
    const e = Event.create(Identity.of("e2"), {
      sessionId: Identity.of("s1"),
      type: "message.sent",
      occurredAt: new Date("2026-07-15T12:00:01.000Z"),
      payload: {},
    });
    expect(e.externalId).toBeUndefined();
  });
});
