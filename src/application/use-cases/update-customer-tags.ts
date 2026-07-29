import { CustomerTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { CustomerRepository, CustomerTimelineRepository } from "../ports/crm-repositories";

/**
 * UpdateCustomerTags — SCR-003 §7 PATCH /customers/:id/tags ("replaceTags").
 * Registra un evento de Timeline por cada etiqueta añadida/quitada (SCR-003
 * §5 "TagAdded"/"TagRemoved").
 */
export interface UpdateCustomerTagsInput {
  customerId: string;
  tags: string[];
}

export class UpdateCustomerTags {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly customers: CustomerRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(input: UpdateCustomerTagsInput): Promise<void> {
    const customer = await this.customers.findById(Identity.of(input.customerId));
    if (!customer) {
      throw new DomainError("UpdateCustomerTags: el Customer no existe");
    }

    const before = new Set(customer.tags);
    const after = new Set(input.tags);

    await this.customers.save(customer.withTags(input.tags));

    for (const tag of after) {
      if (!before.has(tag)) {
        await this.timeline.append(
          CustomerTimelineEntry.create(this.ids.next(), {
            customerId: customer.id,
            type: "tag.added",
            payload: { tag },
            occurredAt: this.clock.now(),
          }),
        );
      }
    }
    for (const tag of before) {
      if (!after.has(tag)) {
        await this.timeline.append(
          CustomerTimelineEntry.create(this.ids.next(), {
            customerId: customer.id,
            type: "tag.removed",
            payload: { tag },
            occurredAt: this.clock.now(),
          }),
        );
      }
    }
  }
}
