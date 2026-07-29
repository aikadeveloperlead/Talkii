import {
  Customer,
  CustomerTimelineEntry,
  Identity,
  Lead,
  type LeadStatus,
} from "@/domain";

/** Mappers de persistencia del bounded context CRM (SCR-003). Mismo patrón que mappers.ts. */

export interface CustomerRow {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  city: string | null;
  country: string | null;
  tags: string[];
  archived_at: string | null;
}

export function customerToRow(customer: Customer): CustomerRow {
  return {
    id: customer.id.toString(),
    tenant_id: customer.tenantId.toString(),
    first_name: customer.firstName,
    last_name: customer.lastName ?? null,
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    company: customer.company ?? null,
    position: customer.position ?? null,
    city: customer.city ?? null,
    country: customer.country ?? null,
    tags: [...customer.tags],
    archived_at: customer.archivedAt ? customer.archivedAt.toISOString() : null,
  };
}

export function rowToCustomer(row: CustomerRow): Customer {
  return Customer.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    firstName: row.first_name,
    lastName: row.last_name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    company: row.company ?? undefined,
    position: row.position ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    tags: row.tags ?? [],
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
  });
}

export interface LeadRow {
  id: string;
  customer_id: string;
  status: LeadStatus;
  score: number;
  priority: string | null;
  owner_id: string | null;
}

export function leadToRow(lead: Lead): LeadRow {
  return {
    id: lead.id.toString(),
    customer_id: lead.customerId.toString(),
    status: lead.status,
    score: lead.score,
    priority: lead.priority ?? null,
    owner_id: lead.ownerId ?? null,
  };
}

export function rowToLead(row: LeadRow): Lead {
  return Lead.create(Identity.of(row.id), {
    customerId: Identity.of(row.customer_id),
    status: row.status,
    score: row.score,
    priority: row.priority ?? undefined,
    ownerId: row.owner_id ?? undefined,
  });
}

export interface CustomerTimelineRow {
  id: string;
  customer_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export function timelineEntryToRow(entry: CustomerTimelineEntry): CustomerTimelineRow {
  return {
    id: entry.id.toString(),
    customer_id: entry.customerId.toString(),
    type: entry.type,
    payload: { ...entry.payload },
    occurred_at: entry.occurredAt.toISOString(),
  };
}

export function rowToTimelineEntry(row: CustomerTimelineRow): CustomerTimelineEntry {
  return CustomerTimelineEntry.create(Identity.of(row.id), {
    customerId: Identity.of(row.customer_id),
    type: row.type,
    payload: row.payload ?? {},
    occurredAt: new Date(row.occurred_at),
  });
}
