import { Company, Identity, Preferences } from "@/domain";

export interface CompanyRow {
  id: string;
  tenant_id: string;
  business_name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}
export function companyToRow(company: Company): CompanyRow {
  return {
    id: company.id.toString(),
    tenant_id: company.tenantId.toString(),
    business_name: company.businessName,
    legal_name: company.legalName ?? null,
    tax_id: company.taxId ?? null,
    email: company.email ?? null,
    phone: company.phone ?? null,
    website: company.website ?? null,
  };
}
export function rowToCompany(row: CompanyRow): Company {
  return Company.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    businessName: row.business_name,
    legalName: row.legal_name ?? undefined,
    taxId: row.tax_id ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
  });
}

export interface PreferencesRow {
  id: string;
  tenant_id: string;
  language: string;
  timezone: string;
  currency: string;
  date_format: string;
}
export function preferencesToRow(preferences: Preferences): PreferencesRow {
  return {
    id: preferences.id.toString(),
    tenant_id: preferences.tenantId.toString(),
    language: preferences.language,
    timezone: preferences.timezone,
    currency: preferences.currency,
    date_format: preferences.dateFormat,
  };
}
export function rowToPreferences(row: PreferencesRow): Preferences {
  return Preferences.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    language: row.language,
    timezone: row.timezone,
    currency: row.currency,
    dateFormat: row.date_format,
  });
}
