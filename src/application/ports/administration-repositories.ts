import { Company, Identity, Preferences } from "@/domain";

export interface CompanyRepository {
  save(company: Company): Promise<void>;
  findByTenant(tenantId: Identity): Promise<Company | null>;
}

export interface PreferencesRepository {
  save(preferences: Preferences): Promise<void>;
  findByTenant(tenantId: Identity): Promise<Preferences | null>;
}
