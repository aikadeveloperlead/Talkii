import { Identity } from "@/domain";
import { CustomerRepository, CustomerSearchFilters } from "../ports/crm-repositories";

/** ListCustomers — SCR-003 §7 GET /customers (paginado + filtros). */
export interface ListCustomersInput {
  tenantId: string;
  query?: string;
  tags?: string[];
  page?: number;
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
  total: number;
  page: number;
}

export class ListCustomers {
  constructor(private readonly customers: CustomerRepository) {}

  async execute(input: ListCustomersInput): Promise<ListCustomersResult> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? input.limit : 20;

    const filters: CustomerSearchFilters = { query: input.query, tags: input.tags };
    const { items, total } = await this.customers.search(
      Identity.of(input.tenantId),
      filters,
      page,
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
      total,
      page,
    };
  }
}
