import { Identity } from "@/domain";
import { AppointmentRepository } from "../ports/scheduling-repositories";

/** ListAppointments — SCR-004 §7 GET /appointments (paginado + filtros). */
export interface ListAppointmentsInput {
  tenantId: string;
  calendarId?: string;
  customerId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export class ListAppointments {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(input: ListAppointmentsInput) {
    const page = input.page && input.page > 0 ? input.page : 1;
    const limit = input.limit && input.limit > 0 ? input.limit : 20;

    const { items, total } = await this.appointments.search(
      Identity.of(input.tenantId),
      {
        calendarId: input.calendarId ? Identity.of(input.calendarId) : undefined,
        customerId: input.customerId ? Identity.of(input.customerId) : undefined,
        status: input.status,
        from: input.from,
        to: input.to,
      },
      page,
      limit,
    );

    return {
      items: items.map((a) => ({
        id: a.id.toString(),
        calendarId: a.calendarId.toString(),
        customerId: a.customerId?.toString(),
        title: a.title,
        status: a.status,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      })),
      total,
      page,
    };
  }
}
