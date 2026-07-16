import { DomainError, Event, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import { EventRepository, SessionRepository } from "../ports/repositories";

/**
 * IngestEvent — registra un hecho consumado sobre una Session (SSOT Cap. 11 §5).
 *
 * Es el punto de activación del ciclo de ejecución: solo registra el Event; no
 * interpreta ni decide (SSOT Cap. 7 §8). La interpretación ocurre después, en
 * MakeDecision.
 */
export interface IngestEventInput {
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  /** Identidad del hecho en el sistema de origen (idempotencia). */
  externalId?: string;
}

export interface IngestEventResult {
  eventId: string;
}

export class IngestEvent {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly sessions: SessionRepository,
    private readonly events: EventRepository,
  ) {}

  async execute(input: IngestEventInput): Promise<IngestEventResult> {
    const sessionId = Identity.of(input.sessionId);

    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new DomainError("IngestEvent: la Session no existe");
    }
    if (!session.isActive) {
      throw new DomainError(
        "IngestEvent: no se pueden registrar Events en una Session cerrada",
      );
    }

    const event = Event.create(this.ids.next(), {
      sessionId,
      type: input.type,
      occurredAt: this.clock.now(),
      payload: input.payload,
      externalId: input.externalId,
    });

    await this.events.append(event);

    return { eventId: event.id.toString() };
  }
}
