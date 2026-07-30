import { afterEach, describe, expect, it } from "vitest";
import { AnthropicReasoningProvider, OpenAIReasoningProvider } from "@/infrastructure";
import { selectReasoningProvider } from "@/app/_lib/container";

/**
 * Item 10 de la auditoría, sub-item 3/5: AA-02 nunca se probó de verdad —
 * AnthropicReasoningProvider jamás se instanciaba fuera de su propio archivo,
 * y container.ts hardcodeaba OpenAIReasoningProvider sin ningún mecanismo de
 * selección. Este test prueba que el proveedor es intercambiable vía
 * configuración (REASONING_PROVIDER), no solo "estructuralmente" abstracto.
 */
describe("selectReasoningProvider — AA-02: elección de proveedor configurable, no hardcodeada", () => {
  const originalChoice = process.env.REASONING_PROVIDER;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.REASONING_PROVIDER = originalChoice;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it("usa OpenAIReasoningProvider por defecto cuando REASONING_PROVIDER no está definido", () => {
    delete process.env.REASONING_PROVIDER;
    process.env.OPENAI_API_KEY = "sk-test";

    expect(selectReasoningProvider()).toBeInstanceOf(OpenAIReasoningProvider);
  });

  it("usa AnthropicReasoningProvider cuando REASONING_PROVIDER=anthropic", () => {
    process.env.REASONING_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    expect(selectReasoningProvider()).toBeInstanceOf(AnthropicReasoningProvider);
  });

  it("usa OpenAIReasoningProvider cuando REASONING_PROVIDER=openai explícito", () => {
    process.env.REASONING_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";

    expect(selectReasoningProvider()).toBeInstanceOf(OpenAIReasoningProvider);
  });
});
