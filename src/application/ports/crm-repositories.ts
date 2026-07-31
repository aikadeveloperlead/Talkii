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
  /** Opaco: pasar de vuelta tal cual para pedir la siguiente página. `null` = no hay más. */
  nextCursor: string | null;
}

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(id: Identity): Promise<Customer | null>;
  /** Para validar unicidad de teléfono por tenant (SCR-003 §7 Validaciones). */
  findByPhone(tenantId: Identity, phone: string): Promise<Customer | null>;
  /**
   * Paginación por cursor (item MEDIO #12 de la auditoría — reemplaza
   * page/OFFSET, que se degrada con el tamaño de la tabla). `cursor` es el
   * `nextCursor` de la página anterior, o `null`/`undefined` para la primera.
   */
  search(
    tenantId: Identity,
    filters: CustomerSearchFilters,
    cursor: string | null | undefined,
    limit: number,
  ): Promise<CustomerSearchResult>;
}

export interface LeadRepository {
  save(lead: Lead): Promise<void>;
  findByCustomerId(customerId: Identity): Promise<Lead | null>;
}

export interface CustomerTimelineRepository {
  append(entry: CustomerTimelineEntry): Promise<void>;
  /** `limit` acota a las entradas MÁS RECIENTES (timeline append-only sin retención). */
  findByCustomer(customerId: Identity, limit?: number): Promise<CustomerTimelineEntry[]>;
}
