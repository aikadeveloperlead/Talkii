import {
  classifyReasoningError,
  ReasoningProviderError,
  type IReasoningProvider,
  type ReasoningRequest,
  type ReasoningResult,
} from "@/application/ports";

/**
 * OpenAIReasoningProvider — adaptador concreto del puerto IReasoningProvider
 * (SSOT Cap. 11 §16) sobre la OpenAI Chat Completions API.
 *
 * Es UNO de los mecanismos que puede alimentar al Decision Engine (AA-02): el
 * dominio jamás conoce esta clase. Usa `fetch` nativo (Node 20+/Next 16) para no
 * añadir dependencias; sustituirlo por otro proveedor no altera el dominio.
 */
export interface OpenAIOptions {
  apiKey?: string;
  /** Modelo Chat Completions. Por defecto `gpt-4o-mini` (equilibrio coste/latencia). */
  model?: string;
  maxTokens?: number;
  /** Inyectable para tests; por defecto `fetch` global. */
  fetchImpl?: typeof fetch;
  /**
   * Milisegundos antes de abortar la llamada (hallazgo HIGH de la auditoría
   * santa-loop: sin timeout, un proveedor que acepta la conexión y no responde
   * cuelga indefinidamente la continuación `after()` del webhook de WhatsApp).
   * Presupuesto más amplio que un POST normal: el razonamiento es lento.
   */
  timeoutMs?: number;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 60_000;

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIReasoningProvider implements IReasoningProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenAIOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAIReasoningProvider: falta OPENAI_API_KEY en el entorno.",
      );
    }
    this.apiKey = apiKey;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.maxTokens = options.maxTokens ?? 1024;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    const userContent = buildUserContent(request);

    const response = await this.fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: "system", content: request.instructions },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      throw new ReasoningProviderError(
        `OpenAIReasoningProvider: la API respondió ${response.status} ${response.statusText}. ${detail}`,
        classifyReasoningError(response.status),
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices?.[0];
    const output = (choice?.message?.content ?? "").trim();

    return {
      output,
      metadata: {
        model: data.model ?? this.model,
        profile: request.profile,
        stopReason: choice?.finish_reason ?? null,
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
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
