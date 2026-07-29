import { Identity } from "@/domain";
import { PreferencesRepository } from "../ports/administration-repositories";

export class GetPreferences {
  constructor(private readonly preferences: PreferencesRepository) {}

  async execute(tenantId: string) {
    const preferences = await this.preferences.findByTenant(Identity.of(tenantId));
    if (!preferences) return null;
    return {
      language: preferences.language,
      timezone: preferences.timezone,
      currency: preferences.currency,
      dateFormat: preferences.dateFormat,
    };
  }
}
