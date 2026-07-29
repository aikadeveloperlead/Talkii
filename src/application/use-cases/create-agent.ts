import { Agent, DomainError, Identity, type CaptureField } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { AgentRepository } from "../ports/repositories";

/** CreateAgent — SCR-008 §6.1 POST /agents (BK-02: nombre único por Tenant). */
export interface CreateAgentInput {
  tenantId: string;
  name: string;
  role: string;
  objective: string;
  permanentPrompt: string;
  reasoningProfile: string;
  personality?: string;
  language?: string;
  tone?: string;
  businessName?: string;
  businessDescription?: string;
  productsServices?: string;
  businessType?: string;
  welcomeMessage?: string;
  fallbackMessage?: string;
  transferKeywords?: string[];
  captureFields?: CaptureField[];
}

export class CreateAgent {
  constructor(
    private readonly ids: IdGenerator,
    private readonly agents: AgentRepository,
  ) {}

  async execute(input: CreateAgentInput): Promise<{ agentId: string }> {
    const tenantId = Identity.of(input.tenantId);

    const existing = await this.agents.findByName(tenantId, input.name);
    if (existing) {
      throw new DomainError("CreateAgent: ya existe un Agent con ese nombre en el Tenant");
    }

    const agent = Agent.create(this.ids.next(), {
      tenantId,
      name: input.name,
      role: input.role,
      objective: input.objective,
      permanentPrompt: input.permanentPrompt,
      policies: [],
      reasoningProfile: input.reasoningProfile,
      status: "draft",
      personality: input.personality,
      language: input.language,
      tone: input.tone,
      businessName: input.businessName,
      businessDescription: input.businessDescription,
      productsServices: input.productsServices,
      businessType: input.businessType,
      welcomeMessage: input.welcomeMessage,
      fallbackMessage: input.fallbackMessage,
      transferKeywords: input.transferKeywords,
      captureFields: input.captureFields,
    });
    await this.agents.save(agent);

    return { agentId: agent.id.toString() };
  }
}
