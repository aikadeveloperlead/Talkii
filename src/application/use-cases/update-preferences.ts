import { Identity, Preferences } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { PreferencesRepository } from "../ports/administration-repositories";

/** UpdatePreferences — SCR-012 §6.5 (upsert, mismo criterio que UpdateCompany). */
export interface UpdatePreferencesInput {
  tenantId: string;
  language?: string;
  timezone?: string;
  currency?: string;
  dateFormat?: string;
}

export class UpdatePreferences {
  constructor(
    private readonly ids: IdGenerator,
    private readonly preferences: PreferencesRepository,
  ) {}

  async execute(input: UpdatePreferencesInput): Promise<void> {
    const tenantId = Identity.of(input.tenantId);
    const existing = await this.preferences.findByTenant(tenantId);

    const preferences = Preferences.create(existing?.id ?? this.ids.next(), {
      tenantId,
      language: input.language ?? existing?.language,
      timezone: input.timezone ?? existing?.timezone,
      currency: input.currency ?? existing?.currency,
      dateFormat: input.dateFormat ?? existing?.dateFormat,
    });
    await this.preferences.save(preferences);
  }
}
