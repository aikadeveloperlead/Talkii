import { Identity } from "@/domain";
import { CompanyRepository } from "../ports/administration-repositories";

export class GetCompany {
  constructor(private readonly companies: CompanyRepository) {}

  async execute(tenantId: string) {
    const company = await this.companies.findByTenant(Identity.of(tenantId));
    if (!company) return null;
    return {
      businessName: company.businessName,
      legalName: company.legalName,
      taxId: company.taxId,
      email: company.email,
      phone: company.phone,
      website: company.website,
    };
  }
}
