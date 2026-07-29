import { Identity } from "@/domain";
import { CalendarRepository } from "../ports/scheduling-repositories";

/** ListCalendars — SCR-004 §7 GET /calendars. */
export class ListCalendars {
  constructor(private readonly calendars: CalendarRepository) {}

  async execute(tenantId: string) {
    const calendars = await this.calendars.listByTenant(Identity.of(tenantId));
    return calendars.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      timezone: c.timezone,
      color: c.color,
      isDefault: c.isDefault,
    }));
  }
}
