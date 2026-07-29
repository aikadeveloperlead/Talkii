import { Identity } from "@/domain";
import { TenantRepository } from "../ports/repositories";

/** GetWorkspace — SCR-012 §6.1 GET /settings/workspace. */
export class GetWorkspace {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(tenantId: string) {
    const tenant = await this.tenants.findById(Identity.of(tenantId));
    if (!tenant) return null;
    return {
      id: tenant.id.toString(),
      name: tenant.name,
      description: tenant.description,
      logo: tenant.logo,
      status: tenant.status,
    };
  }
}
