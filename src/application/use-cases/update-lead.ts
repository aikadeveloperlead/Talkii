import { CustomerTimelineEntry, DomainError, Identity, type LeadStatus } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { CustomerTimelineRepository, LeadRepository } from "../ports/crm-repositories";

/** UpdateLead — SCR-003 §7 PATCH /customers/:id/lead. */
export interface UpdateLeadInput {
  customerId: string;
  status?: LeadStatus;
  score?: number;
}

export class UpdateLead {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly leads: LeadRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(input: UpdateLeadInput): Promise<void> {
    const customerId = Identity.of(input.customerId);
    const lead = await this.leads.findByCustomerId(customerId);
    if (!lead) {
      throw new DomainError("UpdateLead: el Customer no tiene Lead asociado");
    }

    let updated = lead;
    if (input.status) updated = updated.withStatus(input.status);
    if (input.score !== undefined) updated = updated.withScore(input.score);
    await this.leads.save(updated);

    await this.timeline.append(
      CustomerTimelineEntry.create(this.ids.next(), {
        customerId,
        type: "lead.updated",
        payload: { status: updated.status, score: updated.score },
        occurredAt: this.clock.now(),
      }),
    );
  }
}
