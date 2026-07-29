import type { SupabaseClient } from "@supabase/supabase-js";
import { Customer, CustomerTimelineEntry, Identity, Lead } from "@/domain";
import type {
  CustomerRepository,
  CustomerSearchFilters,
  CustomerSearchResult,
  CustomerTimelineRepository,
  LeadRepository,
} from "@/application/ports";
import {
  customerToRow,
  leadToRow,
  rowToCustomer,
  rowToLead,
  rowToTimelineEntry,
  timelineEntryToRow,
  type CustomerRow,
  type CustomerTimelineRow,
  type LeadRow,
} from "./crm-mappers";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

export class SupabaseCustomerRepository implements CustomerRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(customer: Customer): Promise<void> {
    const { error } = await this.db.from("customers").upsert(customerToRow(customer));
    if (error) fail("customers.upsert", error);
  }

  async findById(id: Identity): Promise<Customer | null> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("customers.select", error);
    return data ? rowToCustomer(data as CustomerRow) : null;
  }

  async findByPhone(tenantId: Identity, phone: string): Promise<Customer | null> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId.toString())
      .eq("phone", phone)
      .maybeSingle();
    if (error) fail("customers.select", error);
    return data ? rowToCustomer(data as CustomerRow) : null;
  }

  async search(
    tenantId: Identity,
    filters: CustomerSearchFilters,
    page: number,
    limit: number,
  ): Promise<CustomerSearchResult> {
    let query = this.db
      .from("customers")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId.toString());

    if (!filters.includeArchived) query = query.is("archived_at", null);
    if (filters.query) {
      const q = filters.query;
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
      );
    }
    if (filters.tags?.length) {
      query = query.contains("tags", filters.tags);
    }

    const start = (page - 1) * limit;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(start, start + limit - 1);
    if (error) fail("customers.select", error);

    return {
      items: (data as CustomerRow[]).map(rowToCustomer),
      total: count ?? 0,
    };
  }
}

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(lead: Lead): Promise<void> {
    const { error } = await this.db.from("leads").upsert(leadToRow(lead));
    if (error) fail("leads.upsert", error);
  }

  async findByCustomerId(customerId: Identity): Promise<Lead | null> {
    const { data, error } = await this.db
      .from("leads")
      .select("*")
      .eq("customer_id", customerId.toString())
      .maybeSingle();
    if (error) fail("leads.select", error);
    return data ? rowToLead(data as LeadRow) : null;
  }
}

export class SupabaseCustomerTimelineRepository implements CustomerTimelineRepository {
  constructor(private readonly db: SupabaseClient) {}

  async append(entry: CustomerTimelineEntry): Promise<void> {
    const { error } = await this.db
      .from("customer_timeline")
      .insert(timelineEntryToRow(entry));
    if (error) fail("customer_timeline.insert", error);
  }

  async findByCustomer(customerId: Identity): Promise<CustomerTimelineEntry[]> {
    const { data, error } = await this.db
      .from("customer_timeline")
      .select("*")
      .eq("customer_id", customerId.toString())
      .order("occurred_at", { ascending: true });
    if (error) fail("customer_timeline.select", error);
    return (data as CustomerTimelineRow[]).map(rowToTimelineEntry);
  }
}
