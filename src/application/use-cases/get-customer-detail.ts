import { Identity } from "@/domain";
import {
  CustomerRepository,
  CustomerTimelineRepository,
  LeadRepository,
} from "../ports/crm-repositories";

/** GetCustomerDetail — SCR-003 §7 GET /customers/:id. */
export interface CustomerDetailDTO {
  id: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  city?: string;
  country?: string;
  tags: string[];
  archived: boolean;
  lead: { status: string; score: number; priority?: string; ownerId?: string } | null;
  timeline: { id: string; type: string; payload: Record<string, unknown>; at: Date }[];
}

export class GetCustomerDetail {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly timeline: CustomerTimelineRepository,
  ) {}

  async execute(customerId: string): Promise<CustomerDetailDTO | null> {
    const customer = await this.customers.findById(Identity.of(customerId));
    if (!customer) return null;

    const lead = await this.leads.findByCustomerId(customer.id);
    const entries = await this.timeline.findByCustomer(customer.id);

    return {
      id: customer.id.toString(),
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      company: customer.company,
      position: customer.position,
      city: customer.city,
      country: customer.country,
      tags: [...customer.tags],
      archived: customer.isArchived,
      lead: lead
        ? {
            status: lead.status,
            score: lead.score,
            priority: lead.priority,
            ownerId: lead.ownerId,
          }
        : null,
      timeline: entries
        .map((e) => ({
          id: e.id.toString(),
          type: e.type,
          payload: e.payload,
          at: e.occurredAt,
        }))
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    };
  }
}
