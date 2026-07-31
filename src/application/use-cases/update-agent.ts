import { type CaptureField, DomainError, Identity, NotFoundError } from "@/domain";
import { AgentRepository } from "../ports/repositories";

/** UpdateAgent — SCR-008 §6.1 PUT /agents/:id. */
export interface UpdateAgentInput {
  agentId: string;
  name?: string;
  role?: string;
  objective?: string;
  permanentPrompt?: string;
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

export class UpdateAgent {
  constructor(private readonly agents: AgentRepository) {}

  async execute(input: UpdateAgentInput): Promise<void> {
    const agent = await this.agents.findById(Identity.of(input.agentId));
    if (!agent) {
      throw new NotFoundError("UpdateAgent: el Agent no existe");
    }

    if (input.name && input.name !== agent.name) {
      const existing = await this.agents.findByName(agent.tenantId, input.name);
      if (existing) {
        throw new DomainError("UpdateAgent: ya existe un Agent con ese nombre en el Tenant");
      }
    }

    const { agentId: _omit, ...changes } = input;
    await this.agents.save(agent.withEdits(changes));
  }
}
