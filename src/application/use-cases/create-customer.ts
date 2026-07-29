import { Customer, CustomerTimelineEntry, DomainError, Identity, Lead } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import {
  CustomerRepository,
  CustomerTimelineRepository,
  LeadRepository,
} from "../ports/crm-repositories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * CreateCustomer — SCR-003 §5/§6 (CustomerService.create + Trigger 2 "Nuevo
 * Cliente → Crear Lead"). Un Customer nuevo nace siempre con un Lead inicial
 * (status "new") y una entrada de Timeline — mismo patrón que
 * StartConversation crea su Session inicial (invariante de ciclo de vida
 * garantizada en el caso de uso, no en el constructor de la entidad).
 */
export interface CreateCustomerInput {
  tenantId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  city?: string;
  country?: string;
}

export interface CreateCustomerResult {
  customerId: string;
}

export class CreateCustomer {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    if (input.email && !EMAIL_RE.test(input.email)) {
      throw new DomainError("CreateCustomer: correo inválido");
    }

    const tenantId = Identity.of(input.tenantId);

    if (input.phone) {
      const existing = await this.customers.findByPhone(tenantId, input.phone);
      if (existing) {
        throw new DomainError(
          "CreateCustomer: ya existe un Customer con ese teléfono en el Tenant",
        );
      }
    }

    const customer = Customer.create(this.ids.next(), {
      tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      company: input.company,
      position: input.position,
      city: input.city,
      country: input.country,
      tags: [],
    });
    await this.customers.save(customer);

    const lead = Lead.create(this.ids.next(), {
      customerId: customer.id,
      status: "new",
      score: 0,
    });
    await this.leads.save(lead);

    await this.timeline.append(
      CustomerTimelineEntry.create(this.ids.next(), {
        customerId: customer.id,
        type: "customer.created",
        payload: { firstName: customer.firstName },
        occurredAt: this.clock.now(),
      }),
    );

    return { customerId: customer.id.toString() };
  }
}
