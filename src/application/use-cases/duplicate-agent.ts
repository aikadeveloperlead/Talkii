import { Agent, DomainError, Identity } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { AgentRepository } from "../ports/repositories";

/** DuplicateAgent — SCR-008 §6.1 POST /agents/:id/duplicate (copia como Draft con nombre único). */
export class DuplicateAgent {
  constructor(
    private readonly ids: IdGenerator,
    private readonly agents: AgentRepository,
  ) {}

  async execute(agentId: string): Promise<{ agentId: string }> {
    const source = await this.agents.findById(Identity.of(agentId));
    if (!source) {
      throw new DomainError("DuplicateAgent: el Agent no existe");
    }

    let name = `${source.name} (copia)`;
    let suffix = 2;
    while (await this.agents.findByName(source.tenantId, name)) {
      name = `${source.name} (copia ${suffix})`;
      suffix += 1;
    }

    const duplicate = Agent.create(this.ids.next(), {
      tenantId: source.tenantId,
      name,
      role: source.role,
      objective: source.objective,
      permanentPrompt: source.permanentPrompt,
      policies: [...source.policies],
      reasoningProfile: source.reasoningProfile,
      status: "draft",
      personality: source.personality,
      language: source.language,
      tone: source.tone,
      businessName: source.businessName,
      businessDescription: source.businessDescription,
      productsServices: source.productsServices,
      businessType: source.businessType,
      welcomeMessage: source.welcomeMessage,
      fallbackMessage: source.fallbackMessage,
      transferKeywords: [...source.transferKeywords],
      captureFields: [...source.captureFields],
    });
    await this.agents.save(duplicate);

    return { agentId: duplicate.id.toString() };
  }
}
