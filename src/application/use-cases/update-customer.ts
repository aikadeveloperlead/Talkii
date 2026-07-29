import { CustomerTimelineEntry, DomainError, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { CustomerRepository, CustomerTimelineRepository } from "../ports/crm-repositories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** UpdateCustomer — SCR-003 §7 PUT /customers/:id ("Actualiza información básica"). */
export interface UpdateCustomerInput {
  customerId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  city?: string;
  country?: string;
}

export class UpdateCustomer {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly customers: CustomerRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(input: UpdateCustomerInput): Promise<void> {
    if (input.email && !EMAIL_RE.test(input.email)) {
      throw new DomainError("UpdateCustomer: correo inválido");
    }

    const customer = await this.customers.findById(Identity.of(input.customerId));
    if (!customer) {
      throw new DomainError("UpdateCustomer: el Customer no existe");
    }

    const { customerId: _omit, ...changes } = input;
    const updated = customer.withUpdatedProfile(changes);
    await this.customers.save(updated);

    await this.timeline.append(
      CustomerTimelineEntry.create(this.ids.next(), {
        customerId: customer.id,
        type: "customer.updated",
        payload: { fields: Object.keys(changes) },
        occurredAt: this.clock.now(),
      }),
    );
  }
}
