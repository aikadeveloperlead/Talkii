import { Identity } from "@/domain";
import { AppointmentRepository } from "../ports/scheduling-repositories";

const DEFAULT_LIMIT = 20;
/** Techo de filas por página, para que un `limit` del cliente no vuelque la tabla. */
export const MAX_LIMIT = 100;
/** Techo de página: un OFFSET enorme hace que Postgres escanee y descarte millones de filas. */
export const MAX_PAGE = 10_000;

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
    // Techo además del piso (hallazgo MEDIUM de la auditoría santa-loop:
    // `limit > 0` no acotaba por arriba, así que ?limit=5000000 volcaba la
    // tabla entera del Tenant en una sola respuesta).
    const page = Math.min(Math.max(input.page ?? 1, 1), MAX_PAGE);
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

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
