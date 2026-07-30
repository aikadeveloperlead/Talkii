import { describe, expect, it, vi } from "vitest";
import { AnthropicReasoningProvider } from "@/infrastructure";
import type { ReasoningRequest } from "@/application/ports";

/**
 * Item 10 de la auditoría, sub-item 3/5: "AA-02 nunca se probó de verdad —
 * Anthropic provider jamás se instancia/testea". Mismo patrón de test que
 * openai-reasoning-provider.test.ts (mismo puerto IReasoningProvider, mismo
 * enfoque fetchImpl inyectable) — prueba el adaptador ya implementado
 * (commit 775bbd8) que hasta ahora no tenía ningún test propio.
 */
function baseRequest(overrides: Partial<ReasoningRequest> = {}): ReasoningRequest {
  return {
    profile: "sales-default",
    instructions: "Eres un asistente de ventas cordial.",
    input: "quiero información de precios",
    context: {},
    ...overrides,
  };
}

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      statusText: ok ? "OK" : "Error",
    }),
  ) as unknown as typeof fetch;
}

describe("AnthropicReasoningProvider (adaptador IReasoningProvider sobre la Messages API)", () => {
  it("lanza si no hay ANTHROPIC_API_KEY ni apiKey inyectada", () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => new AnthropicReasoningProvider()).toThrow(/ANTHROPIC_API_KEY/);
    if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;
  });

  it("mapea la respuesta de Messages API a ReasoningResult", async () => {
    const fetchImpl = fakeFetch({
      model: "claude-sonnet-5",
      content: [{ type: "text", text: "Hola, ¿en qué puedo ayudarte?" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 42, output_tokens: 8 },
    });
    const provider = new AnthropicReasoningProvider({ apiKey: "sk-ant-test", fetchImpl });

    const result = await provider.reason(baseRequest());

    expect(result.output).toBe("Hola, ¿en qué puedo ayudarte?");
    expect(result.metadata).toMatchObject({
      model: "claude-sonnet-5",
      profile: "sales-default",
      stopReason: "end_turn",
      inputTokens: 42,
      outputTokens: 8,
    });
  });

  it("envía instructions como system y input+context como mensaje user", async () => {
    const fetchImpl = fakeFetch({
      model: "claude-sonnet-5",
      content: [{ type: "text", text: "ok" }],
    });
    const provider = new AnthropicReasoningProvider({ apiKey: "sk-ant-test", fetchImpl });

    await provider.reason(baseRequest({ context: { nombre: "Ana" } }));

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.system).toBe("Eres un asistente de ventas cordial.");
    expect(parsedBody.messages).toHaveLength(1);
    expect(parsedBody.messages[0].role).toBe("user");
    expect(parsedBody.messages[0].content).toContain("quiero información de precios");
    expect(parsedBody.messages[0].content).toContain("Ana");
  });

  it("lanza un error descriptivo cuando la API responde con error", async () => {
    const fetchImpl = fakeFetch({ error: { message: "invalid_api_key" } }, false, 401);
    const provider = new AnthropicReasoningProvider({ apiKey: "sk-ant-bad", fetchImpl });

    await expect(provider.reason(baseRequest())).rejects.toThrow(/401/);
  });

  it("cuando no hay bloques de texto en la respuesta, produce output vacío", async () => {
    const fetchImpl = fakeFetch({
      model: "claude-sonnet-5",
      content: [],
    });
    const provider = new AnthropicReasoningProvider({ apiKey: "sk-ant-test", fetchImpl });

    const result = await provider.reason(baseRequest());

    expect(result.output).toBe("");
  });
});
