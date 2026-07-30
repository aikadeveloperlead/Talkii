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

/** Fila de customers tal como la devuelve `search` — incluye `created_at`, que `CustomerRow` no expone (no es parte del dominio, solo del cursor de paginación). */
type CustomerSearchRow = CustomerRow & { created_at: string };

function encodeCustomerCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

function decodeCustomerCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Quita los caracteres con significado estructural en el mini-lenguaje de
 * filtros de PostgREST (`,` separa condiciones, `(`/`)` las agrupa) de un
 * término de búsqueda antes de interpolarlo en `.or()` — evita que el
 * usuario inyecte predicados extra sobre columnas no intencionadas (hallazgo
 * MEDIO de auditoría). `%`/`_` (wildcards de ILIKE) se dejan intactos: solo
 * amplían el propio match, no rompen la estructura del filtro.
 */
function sanitizePostgrestOrValue(value: string): string {
  return value.replace(/[,()]/g, "");
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

  /**
   * Paginación por cursor (item MEDIO #12 de la auditoría — reemplaza
   * page/OFFSET). El cursor codifica `(created_at, id)` de la última fila de
   * la página anterior; keyset predicate (`<` sobre esa tupla, mismo orden
   * `created_at desc, id desc`) evita el re-escaneo de OFFSET. `pg_trgm`
   * (migración 0024) acelera el ILIKE de abajo.
   */
  async search(
    tenantId: Identity,
    filters: CustomerSearchFilters,
    cursor: string | null | undefined,
    limit: number,
  ): Promise<CustomerSearchResult> {
    let query = this.db
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId.toString());

    if (!filters.includeArchived) query = query.is("archived_at", null);
    if (filters.query) {
      const q = sanitizePostgrestOrValue(filters.query);
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
      );
    }
    if (filters.tags?.length) {
      query = query.contains("tags", filters.tags);
    }
    if (cursor) {
      const decoded = decodeCustomerCursor(cursor);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
        );
      }
    }

    // Pide 1 fila de más para saber si hay siguiente página sin un COUNT aparte.
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (error) fail("customers.select", error);

    const rows = data as CustomerSearchRow[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map(rowToCustomer),
      nextCursor: hasMore && last ? encodeCustomerCursor(last.created_at, last.id) : null,
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
