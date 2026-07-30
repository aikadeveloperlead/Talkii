import { describe, expect, it } from "vitest";
import { HttpWebhookSender } from "@/infrastructure";
import type { WebhookSendTarget } from "@/application/ports";

function buildTarget(url = "https://example.com/hook"): WebhookSendTarget {
  return { url, secret: "s3cret" };
}

describe("HttpWebhookSender (SCR-011 §4.4 — SSRF + timeout)", () => {
  it("bloquea el envío si el host resuelve a una IP privada (DNS rebinding)", async () => {
    let fetchCalled = false;
    const sender = new HttpWebhookSender({
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
      resolveHost: async () => [{ address: "10.0.0.5" }],
    });

    await expect(sender.send(buildTarget(), "message.received", {})).rejects.toThrow(
      /SSRF|red privada/i,
    );
    expect(fetchCalled).toBe(false);
  });

  it("bloquea el envío si el host resuelve al servicio de metadata en la nube", async () => {
    const sender = new HttpWebhookSender({
      fetchImpl: async () => new Response(null, { status: 200 }),
      resolveHost: async () => [{ address: "169.254.169.254" }],
    });

    await expect(sender.send(buildTarget(), "message.received", {})).rejects.toThrow();
  });

  it("envía normalmente cuando el host resuelve a una IP pública, con timeout configurado", async () => {
    let capturedInit: RequestInit | undefined;
    const sender = new HttpWebhookSender({
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return new Response(null, { status: 204 });
      },
      resolveHost: async () => [{ address: "93.184.216.34" }],
      timeoutMs: 5000,
    });

    const result = await sender.send(buildTarget(), "message.received", { foo: "bar" });

    expect(result.status).toBe(204);
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    expect((capturedInit?.headers as Record<string, string>)["X-Talkii-Signature-256"]).toMatch(
      /^sha256=/,
    );
  });
});
