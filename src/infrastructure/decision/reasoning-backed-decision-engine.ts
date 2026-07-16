import { Decision, type Action, type Agent, type Event, type Funnel } from "@/domain";
import type {
  ExecutionContext,
  IDecisionEngine,
  IdGenerator,
  IReasoningProvider,
  ReasoningRequest,
} from "@/application/ports";

/**
 * ReasoningBackedDecisionEngine — un Decision Engine concreto (SSOT Cap. 11 §7-8).
 *
 * Interpreta el Event a través de un `IReasoningProvider` abstracto y materializa
 * una `Decision` con `source: "ai-model"`. Cumple AA-02 (Decision Engine
 * Independence): depende del PUERTO de razonamiento, nunca de un proveedor LLM
 * concreto. Sustituir Anthropic por OpenAI/Google —o por un motor de reglas— no
 * cambia esta clase.
 *
 * Respeta la separación decidir/ejecutar (SSOT §14): produce el plan de Actions
 * pero NO las ejecuta.
 */
export class ReasoningBackedDecisionEngine implements IDecisionEngine {
  constructor(
    private readonly reasoning: IReasoningProvider,
    private readonly ids: IdGenerator,
  ) {}

  async decide(context: ExecutionContext): Promise<Decision> {
    const { event, session, agent, funnel, snapshot } = context;

    const request: ReasoningRequest = {
      profile: agent.reasoningProfile,
      instructions: buildInstructions(agent, funnel),
      input: extractInput(event),
      context: snapshot,
    };

    const result = await this.reasoning.reason(request);
    const output = result.output.trim();

    const actions: Action[] = output.length
      ? [{ type: "message.send", params: { text: output } }]
      : [];

    return Decision.create(this.ids.next(), {
      sessionId: session.id,
      eventId: event.id,
      source: "ai-model",
      rationale: buildRationale(agent, output, result.metadata),
      actions,
    });
  }
}

/**
 * Instrucciones permanentes: el prompt del Agent, su objetivo, sus políticas y
 * —si hay Funnel vigente— las etapas de la estrategia comercial. Es la parte
 * estable de la interpretación (SSOT Cap. 5 §19).
 */
function buildInstructions(agent: Agent, funnel: Funnel | null): string {
  const parts: string[] = [agent.permanentPrompt.trim(), `Objetivo: ${agent.objective}`];

  if (agent.policies.length) {
    const policies = agent.policies.map((p) => `- ${p.name}: ${p.rule}`).join("\n");
    parts.push(`Políticas:\n${policies}`);
  }

  if (funnel) {
    const stages = funnel.stages
      .map((s) => `- ${s.name}: ${s.objective} (transición: ${s.transitionCriteria})`)
      .join("\n");
    parts.push(`Funnel «${funnel.name}»:\n${stages}`);
  }

  return parts.filter((p) => p.length > 0).join("\n\n");
}

/**
 * Situación concreta a interpretar. Prioriza texto legible del payload
 * (`text`/`body`/`message`); si no lo hay, serializa el payload como respaldo.
 * El Event no interpreta su payload (SSOT §8): esa lectura ocurre aquí.
 */
function extractInput(event: Event): string {
  const payload = event.payload;
  for (const key of ["text", "body", "message", "content"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return `[${event.type}] ${JSON.stringify(payload)}`;
}

/** Rationale trazable (SSOT §9): perfil usado + resumen + metadatos del proveedor. */
function buildRationale(
  agent: Agent,
  output: string,
  metadata: Record<string, unknown>,
): string {
  const summary = output.length > 160 ? `${output.slice(0, 157)}...` : output || "(sin salida)";
  const model = typeof metadata.model === "string" ? ` · model=${metadata.model}` : "";
  return `Reasoning[${agent.reasoningProfile}]${model}: ${summary}`;
}
