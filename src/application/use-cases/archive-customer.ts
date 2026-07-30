import { CustomerTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { CustomerRepository, CustomerTimelineRepository } from "../ports/crm-repositories";

/**
 * ArchiveCustomer — SCR-003 §6 Trigger 5 / §7 DELETE /customers/:id: "Soft
 * Delete. Nunca Hard Delete." El Customer no se borra; se marca `archivedAt`.
 */
export class ArchiveCustomer {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly customers: CustomerRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(customerId: string): Promise<void> {
    const customer = await this.customers.findById(Identity.of(customerId));
    if (!customer) {
      throw new DomainError("ArchiveCustomer: el Customer no existe");
    }

    await this.customers.save(customer.archived(this.clock.now()));

    await this.timeline.append(
      CustomerTimelineEntry.create(this.ids.next(), {
        customerId: customer.id,
        type: "customer.archived",
        payload: {},
        occurredAt: this.clock.now(),
      }),
    );
  }
}
