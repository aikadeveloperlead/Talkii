import type {
  IReasoningProvider,
  ReasoningRequest,
  ReasoningResult,
} from "@/application/ports";

/**
 * AnthropicReasoningProvider — adaptador concreto del puerto IReasoningProvider
 * (SSOT Cap. 11 §16) sobre la Anthropic Messages API.
 *
 * Es UNO de los mecanismos que puede alimentar al Decision Engine (AA-02): el
 * dominio jamás conoce esta clase. Usa `fetch` nativo (Node 20+/Next 16) para no
 * añadir dependencias; sustituirlo por otro proveedor no altera el dominio.
 */
export interface AnthropicOptions {
  apiKey?: string;
  /** Modelo Claude. Por defecto `claude-sonnet-5` (equilibrio coste/latencia). */
  model?: string;
  maxTokens?: number;
  /** Inyectable para tests; por defecto `fetch` global. */
  fetchImpl?: typeof fetch;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicReasoningProvider implements IReasoningProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AnthropicReasoningProvider: falta ANTHROPIC_API_KEY en el entorno.",
      );
    }
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
    this.maxTokens = options.maxTokens ?? 1024;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    const system = request.instructions;
    const userContent = buildUserContent(request);

    const response = await this.fetchImpl(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      throw new Error(
        `AnthropicReasoningProvider: la API respondió ${response.status} ${response.statusText}. ${detail}`,
      );
    }

    const data = (await response.json()) as AnthropicResponse;
    const output = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("")
      .trim();

    return {
      output,
      metadata: {
        model: data.model ?? this.model,
        profile: request.profile,
        stopReason: data.stop_reason ?? null,
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
      },
    };
  }
}

/** Compone el mensaje de usuario: la situación a interpretar + su contexto efímero. */
function buildUserContent(request: ReasoningRequest): string {
  const hasContext = Object.keys(request.context).length > 0;
  const contextBlock = hasContext
    ? `\n\nContexto:\n${JSON.stringify(request.context, null, 2)}`
    : "";
  return `${request.input}${contextBlock}`;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
