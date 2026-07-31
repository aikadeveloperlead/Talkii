import { Identity } from "@/domain";
import { CustomerRepository, CustomerSearchFilters } from "../ports/crm-repositories";

const DEFAULT_LIMIT = 20;
/** Techo de filas por página, para que un `limit` del cliente no vuelque la tabla. */
export const MAX_LIMIT = 100;

/** ListCustomers — SCR-003 §7 GET /customers (paginado por cursor + filtros). */
export interface ListCustomersInput {
  tenantId: string;
  query?: string;
  tags?: string[];
  cursor?: string;
  limit?: number;
}

export interface ListCustomersResult {
  items: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    tags: string[];
    archived: boolean;
  }[];
  nextCursor: string | null;
}

export class ListCustomers {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(input: ListCustomersInput): Promise<ListCustomersResult> {
    // Techo además del piso (hallazgo MEDIUM de la auditoría santa-loop:
    // `limit > 0` no acotaba por arriba, así que ?limit=5000000 volcaba la
    // tabla entera del Tenant en una sola respuesta).
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const filters: CustomerSearchFilters = { query: input.query, tags: input.tags };
    const { items, nextCursor } = await this.customers.search(
      Identity.of(input.tenantId),
      filters,
      input.cursor ?? null,
      limit,
    );

    return {
      items: items.map((c) => ({
        id: c.id.toString(),
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        tags: [...c.tags],
        archived: c.isArchived,
      })),
      nextCursor,
    };
  }
}
