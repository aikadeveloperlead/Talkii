import { Calendar, Identity } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { CalendarRepository } from "../ports/scheduling-repositories";

/** CreateCalendar — SCR-004: infraestructura mínima para poder agendar (sin la cual no hay Calendar donde crear un Appointment). */
export interface CreateCalendarInput {
  tenantId: string;
  name: string;
  timezone: string;
  color?: string;
  isDefault?: boolean;
}

export class CreateCalendar {
  constructor(
    private readonly ids: IdGenerator,
    private readonly calendars: CalendarRepository,
  ) {}

  async execute(input: CreateCalendarInput): Promise<{ calendarId: string }> {
    const calendar = Calendar.create(this.ids.next(), {
      tenantId: Identity.of(input.tenantId),
      name: input.name,
      timezone: input.timezone,
      color: input.color,
      isDefault: input.isDefault ?? false,
    });
    await this.calendars.save(calendar);
    return { calendarId: calendar.id.toString() };
  }
}
