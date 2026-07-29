import { describe, expect, it, vi } from "vitest";
import { OpenAIReasoningProvider } from "@/infrastructure";
import type { ReasoningRequest } from "@/application/ports";

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

describe("OpenAIReasoningProvider (adaptador IReasoningProvider sobre Chat Completions)", () => {
  it("lanza si no hay OPENAI_API_KEY ni apiKey inyectada", () => {
    const prevKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIReasoningProvider()).toThrow(/OPENAI_API_KEY/);
    if (prevKey) process.env.OPENAI_API_KEY = prevKey;
  });

  it("mapea la respuesta de Chat Completions a ReasoningResult", async () => {
    const fetchImpl = fakeFetch({
      model: "gpt-4o-mini",
      choices: [
        { message: { content: "Hola, ¿en qué puedo ayudarte?" }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 42, completion_tokens: 8 },
    });
    const provider = new OpenAIReasoningProvider({ apiKey: "sk-test", fetchImpl });

    const result = await provider.reason(baseRequest());

    expect(result.output).toBe("Hola, ¿en qué puedo ayudarte?");
    expect(result.metadata).toMatchObject({
      model: "gpt-4o-mini",
      profile: "sales-default",
      stopReason: "stop",
      inputTokens: 42,
      outputTokens: 8,
    });
  });

  it("envía instructions como mensaje system y input+context como mensaje user", async () => {
    const fetchImpl = fakeFetch({
      model: "gpt-4o-mini",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    });
    const provider = new OpenAIReasoningProvider({ apiKey: "sk-test", fetchImpl });

    await provider.reason(baseRequest({ context: { nombre: "Ana" } }));

    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.messages[0]).toEqual({
      role: "system",
      content: "Eres un asistente de ventas cordial.",
    });
    expect(parsedBody.messages[1].role).toBe("user");
    expect(parsedBody.messages[1].content).toContain("quiero información de precios");
    expect(parsedBody.messages[1].content).toContain("Ana");
  });

  it("lanza un error descriptivo cuando la API responde con error", async () => {
    const fetchImpl = fakeFetch({ error: { message: "invalid_api_key" } }, false, 401);
    const provider = new OpenAIReasoningProvider({ apiKey: "sk-bad", fetchImpl });

    await expect(provider.reason(baseRequest())).rejects.toThrow(/401/);
  });

  it("cuando no hay content en la respuesta, produce output vacío", async () => {
    const fetchImpl = fakeFetch({
      model: "gpt-4o-mini",
      choices: [{ message: {}, finish_reason: "stop" }],
    });
    const provider = new OpenAIReasoningProvider({ apiKey: "sk-test", fetchImpl });

    const result = await provider.reason(baseRequest());

    expect(result.output).toBe("");
  });
});
