import { Company, Identity } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { CompanyRepository } from "../ports/administration-repositories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** UpdateCompany — SCR-012 §6.2 (upsert: "Existe una única configuración activa por Workspace" — CFG-01/CFG-02). */
export interface UpdateCompanyInput {
  tenantId: string;
  businessName: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export class UpdateCompany {
  constructor(
    private readonly ids: IdGenerator,
    private readonly companies: CompanyRepository,
  ) {}

  async execute(input: UpdateCompanyInput): Promise<void> {
    if (input.email && !EMAIL_RE.test(input.email)) {
      throw new Error("UpdateCompany: correo inválido");
    }
    const tenantId = Identity.of(input.tenantId);
    const existing = await this.companies.findByTenant(tenantId);

    const company = Company.create(existing?.id ?? this.ids.next(), {
      tenantId,
      businessName: input.businessName,
      legalName: input.legalName ?? existing?.legalName,
      taxId: input.taxId ?? existing?.taxId,
      email: input.email ?? existing?.email,
      phone: input.phone ?? existing?.phone,
      website: input.website ?? existing?.website,
    });
    await this.companies.save(company);
  }
}
