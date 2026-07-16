import { describe, expect, it } from "vitest";
import { WhatsAppMessageSender } from "@/infrastructure/whatsapp/whatsapp-message-sender";
import type { ChannelBinding } from "@/application/ports";

const binding: ChannelBinding = {
  tenantId: "t1",
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: "a1",
};

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function makeFetchFake(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.json ?? {},
      text: async () => response.text ?? "",
    } as Response;
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("WhatsAppMessageSender (Graph API)", () => {
  it("envía el mensaje con URL, headers y body correctos", async () => {
    const { calls, fetchFn } = makeFetchFake({
      ok: true,
      json: { messages: [{ id: "wamid.OUT-9" }] },
    });
    const sender = new WhatsAppMessageSender({
      accessToken: "token-global",
      graphVersion: "v23.0",
      fetchFn,
    });

    const result = await sender.send({ binding, to: "573001112233", text: "¡Hola!" });

    expect(result.externalMessageId).toBe("wamid.OUT-9");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v23.0/phone-123/messages",
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-global");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      messaging_product: "whatsapp",
      to: "573001112233",
      type: "text",
      text: { body: "¡Hola!" },
    });
  });

  it("prioriza el accessToken del binding sobre el global", async () => {
    const { calls, fetchFn } = makeFetchFake({ ok: true, json: { messages: [] } });
    const sender = new WhatsAppMessageSender({ accessToken: "token-global", fetchFn });

    await sender.send({
      binding: { ...binding, accessToken: "token-del-binding" },
      to: "57300",
      text: "hola",
    });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-del-binding");
  });

  it("lanza ante respuesta HTTP de error", async () => {
    const { fetchFn } = makeFetchFake({ ok: false, status: 401, text: "invalid token" });
    const sender = new WhatsAppMessageSender({ accessToken: "x", fetchFn });

    await expect(
      sender.send({ binding, to: "57300", text: "hola" }),
    ).rejects.toThrow("WhatsApp send: HTTP 401");
  });

  it("lanza si no hay ningún access token disponible", async () => {
    const { fetchFn } = makeFetchFake({ ok: true });
    const sender = new WhatsAppMessageSender({ fetchFn });
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(
      sender.send({ binding, to: "57300", text: "hola" }),
    ).rejects.toThrow("WHATSAPP_ACCESS_TOKEN");
  });
});
