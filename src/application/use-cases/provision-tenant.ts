import { Tenant } from "@/domain";
import { AuthGateway } from "../ports/auth-gateway";
import { IdGenerator } from "../ports/id-generator";
import { TenantRepository } from "../ports/repositories";

/**
 * ProvisionTenant — aprovisionamiento self-service de una organización.
 *
 * Materializa la decisión de onboarding (SSOT: signup self-service, cada
 * registro crea su propia organización). Sin lógica condicional de
 * idempotencia dentro: la capa `app` garantiza que solo se invoca cuando el
 * usuario aún no tiene el claim `tenant_id`.
 */
export interface ProvisionTenantInput {
  userId: string;
  organizationName: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
}

export class ProvisionTenant {
  constructor(
    private readonly ids: IdGenerator,
    private readonly tenants: TenantRepository,
    private readonly authGateway: AuthGateway,
  ) {}

  async execute(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    // `ownerUserId` hace explícita la relación usuario↔organización, que antes
    // solo existía como claim en el JWT. El índice único parcial de la
    // migración 0030 convierte esto en el backstop de la carrera: un doble
    // submit del onboarding choca con 23505 en vez de crear un Tenant huérfano
    // e inalcanzable (hallazgo MEDIUM de la auditoría santa-loop).
    const tenant = Tenant.create(this.ids.next(), {
      name: input.organizationName,
      ownerUserId: input.userId,
    });

    await this.tenants.create(tenant);
    await this.authGateway.assignTenantToUser(
      input.userId,
      tenant.id.toString(),
    );

    return { tenantId: tenant.id.toString() };
  }
}
