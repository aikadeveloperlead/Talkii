import type { SupabaseClient } from "@supabase/supabase-js";
import { Company, Identity, Preferences } from "@/domain";
import type { CompanyRepository, PreferencesRepository } from "@/application/ports";
import {
  companyToRow,
  preferencesToRow,
  rowToCompany,
  rowToPreferences,
  type CompanyRow,
  type PreferencesRow,
} from "./administration-mappers";

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op}: ${error.message}`);
}

export class SupabaseCompanyRepository implements CompanyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(company: Company): Promise<void> {
    const { error } = await this.db.from("companies").upsert(companyToRow(company));
    if (error) fail("companies.upsert", error);
  }

  async findByTenant(tenantId: Identity): Promise<Company | null> {
    const { data, error } = await this.db
      .from("companies")
      .select("id,tenant_id,business_name,legal_name,tax_id,email,phone,website")
      .eq("tenant_id", tenantId.toString())
      .maybeSingle();
    if (error) fail("companies.select", error);
    return data ? rowToCompany(data as CompanyRow) : null;
  }
}

export class SupabasePreferencesRepository implements PreferencesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(preferences: Preferences): Promise<void> {
    const { error } = await this.db.from("preferences").upsert(preferencesToRow(preferences));
    if (error) fail("preferences.upsert", error);
  }

  async findByTenant(tenantId: Identity): Promise<Preferences | null> {
    const { data, error } = await this.db
      .from("preferences")
      .select("id,tenant_id,language,timezone,currency,date_format")
      .eq("tenant_id", tenantId.toString())
      .maybeSingle();
    if (error) fail("preferences.select", error);
    return data ? rowToPreferences(data as PreferencesRow) : null;
  }
}
