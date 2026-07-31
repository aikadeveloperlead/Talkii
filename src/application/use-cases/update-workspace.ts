import { Identity, NotFoundError } from "@/domain";
import { TenantRepository } from "../ports/repositories";

/** UpdateWorkspace — SCR-012 §6.1 PUT /settings/workspace. */
export interface UpdateWorkspaceInput {
  tenantId: string;
  name?: string;
  description?: string;
  logo?: string;
}

export class UpdateWorkspace {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(input: UpdateWorkspaceInput): Promise<void> {
    const tenant = await this.tenants.findById(Identity.of(input.tenantId));
    if (!tenant) {
      throw new NotFoundError("UpdateWorkspace: el Workspace no existe");
    }
    const { tenantId: _omit, ...changes } = input;
    await this.tenants.save(tenant.withEdits(changes));
  }
}
