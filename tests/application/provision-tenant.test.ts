import { describe, expect, it } from "vitest";
import { Identity } from "@/domain";
import { ProvisionTenant } from "@/application/use-cases";
import { FakeAuthGateway, InMemoryTenants, SequentialIds } from "../fakes";

describe("ProvisionTenant (fase Auth + onboarding)", () => {
  it("crea el Tenant y asigna el claim tenant_id al usuario", async () => {
    const ids = new SequentialIds();
    const tenants = new InMemoryTenants();
    const authGateway = new FakeAuthGateway();
    const useCase = new ProvisionTenant(ids, tenants, authGateway);

    const { tenantId } = await useCase.execute({
      userId: "user-1",
      organizationName: "Acme Corp",
    });

    const stored = await tenants.findById(Identity.of(tenantId));
    expect(stored?.name).toBe("Acme Corp");
    expect(authGateway.assignments).toEqual([{ userId: "user-1", tenantId }]);
  });

  it("propaga el fallo si el AuthGateway no puede asignar el claim (tenant huérfano aceptado)", async () => {
    const ids = new SequentialIds();
    const tenants = new InMemoryTenants();
    const authGateway = new FakeAuthGateway(new Error("admin API caída"));
    const useCase = new ProvisionTenant(ids, tenants, authGateway);

    await expect(
      useCase.execute({ userId: "user-1", organizationName: "Acme Corp" }),
    ).rejects.toThrow("admin API caída");

    const orphaned = await tenants.findById(Identity.of("id-1"));
    expect(orphaned?.name).toBe("Acme Corp");
  });
});
