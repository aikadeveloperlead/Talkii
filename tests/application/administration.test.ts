import { describe, expect, it } from "vitest";
import { DomainError, Identity, Tenant } from "@/domain";
import {
  GetCompany,
  GetPreferences,
  GetWorkspace,
  UpdateCompany,
  UpdatePreferences,
  UpdateWorkspace,
} from "@/application/use-cases";
import {
  InMemoryCompanies,
  InMemoryPreferences,
  InMemoryTenants,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const tenants = new InMemoryTenants();
  const companies = new InMemoryCompanies();
  const preferences = new InMemoryPreferences();
  return {
    tenants,
    companies,
    preferences,
    updateWorkspace: new UpdateWorkspace(tenants),
    getWorkspace: new GetWorkspace(tenants),
    updateCompany: new UpdateCompany(ids, companies),
    getCompany: new GetCompany(companies),
    updatePreferences: new UpdatePreferences(ids, preferences),
    getPreferences: new GetPreferences(preferences),
  };
}

describe("UpdateWorkspace / GetWorkspace (SCR-012 §6.1)", () => {
  it("actualiza descripción y logo del Workspace (Tenant)", async () => {
    const { tenants, updateWorkspace, getWorkspace } = setup();
    await tenants.save(Tenant.create(Identity.of(tenantId), { name: "Aika" }));

    await updateWorkspace.execute({ tenantId, description: "SaaS de agentes IA", logo: "https://x/logo.png" });

    const workspace = await getWorkspace.execute(tenantId);
    expect(workspace?.name).toBe("Aika");
    expect(workspace?.description).toBe("SaaS de agentes IA");
    expect(workspace?.status).toBe("active");
  });

  it("falla si el Workspace no existe", async () => {
    const { updateWorkspace } = setup();
    await expect(updateWorkspace.execute({ tenantId: "no-existe", name: "X" })).rejects.toThrow(
      DomainError,
    );
  });
});

describe("UpdateCompany / GetCompany (SCR-012 §6.2, upsert CFG-01/CFG-02)", () => {
  it("crea en el primer save y actualiza en el segundo (una sola config activa)", async () => {
    const { updateCompany, getCompany } = setup();

    await updateCompany.execute({ tenantId, businessName: "Aika Solutions" });
    await updateCompany.execute({ tenantId, businessName: "Aika Solutions SAS", taxId: "900123456" });

    const company = await getCompany.execute(tenantId);
    expect(company?.businessName).toBe("Aika Solutions SAS");
    expect(company?.taxId).toBe("900123456");
  });

  it("un PUT parcial conserva los campos no tocados (bug undefined-overwrite, hallazgo alto de auditoría)", async () => {
    const { updateCompany, getCompany } = setup();

    await updateCompany.execute({
      tenantId,
      businessName: "Aika Solutions",
      legalName: "Aika Solutions SAS",
      taxId: "900123456",
      email: "hola@aika.co",
      phone: "+573001112233",
      website: "https://aika.co",
    });

    // PUT parcial: solo cambia businessName, no manda el resto de campos.
    await updateCompany.execute({ tenantId, businessName: "Aika Solutions SAS" });

    const company = await getCompany.execute(tenantId);
    expect(company?.businessName).toBe("Aika Solutions SAS");
    expect(company?.legalName).toBe("Aika Solutions SAS");
    expect(company?.taxId).toBe("900123456");
    expect(company?.email).toBe("hola@aika.co");
    expect(company?.phone).toBe("+573001112233");
    expect(company?.website).toBe("https://aika.co");
  });
});

describe("UpdatePreferences / GetPreferences (SCR-012 §6.5)", () => {
  it("aplica defaults en la primera escritura y conserva valores no tocados en la segunda", async () => {
    const { updatePreferences, getPreferences } = setup();

    await updatePreferences.execute({ tenantId, language: "en" });
    expect((await getPreferences.execute(tenantId))?.language).toBe("en");
    expect((await getPreferences.execute(tenantId))?.currency).toBe("USD"); // default

    await updatePreferences.execute({ tenantId, currency: "COP" });
    const preferences = await getPreferences.execute(tenantId);
    expect(preferences?.language).toBe("en"); // conservado
    expect(preferences?.currency).toBe("COP");
  });
});
