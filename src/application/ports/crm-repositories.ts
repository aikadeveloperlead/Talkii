import { Customer, CustomerTimelineEntry, Identity, Lead } from "@/domain";

/**
 * Puertos de persistencia del bounded context CRM (SCR-003). Mismo patrón que
 * `repositories.ts`: interfaces en `application`, implementación concreta en
 * `infrastructure`.
 */
export interface CustomerSearchFilters {
  query?: string;
  tags?: string[];
  includeArchived?: boolean;
}

export interface CustomerSearchResult {
  items: Customer[];
  total: number;
}

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(id: Identity): Promise<Customer | null>;
  /** Para validar unicidad de teléfono por tenant (SCR-003 §7 Validaciones). */
  findByPhone(tenantId: Identity, phone: string): Promise<Customer | null>;
  search(
    tenantId: Identity,
    filters: CustomerSearchFilters,
    page: number,
    limit: number,
  ): Promise<CustomerSearchResult>;
}

export interface LeadRepository {
  save(lead: Lead): Promise<void>;
  findByCustomerId(customerId: Identity): Promise<Lead | null>;
}

export interface CustomerTimelineRepository {
  append(entry: CustomerTimelineEntry): Promise<void>;
  findByCustomer(customerId: Identity): Promise<CustomerTimelineEntry[]>;
}
