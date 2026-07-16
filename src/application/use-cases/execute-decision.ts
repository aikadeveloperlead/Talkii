import { DomainError, Event, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import type { ChannelBinding } from "../ports/channel-binding";
import type { MessageSender } from "../ports/message-sender";
import { DecisionRepository, EventRepository } from "../ports/repositories";

/**
 * ExecuteDecision — materializa el plan de Actions de una Decision (SSOT
 * Cap. 11 §14: decidir y ejecutar son responsabilidades separadas).
 *
 * En esta fase ejecuta `message.send` vía el puerto MessageSender; cada envío
 * queda registrado como Event `message.sent` (hecho consumado, trazable en el
 * timeline de la Session). Actions de tipo desconocido se omiten: el plan
 * puede contener cursos de acción que aún no tienen ejecutor.
 */
export interface ExecuteDecisionInput {
  decisionId: string;
  binding: ChannelBinding;
  /** Handle del destinatario en el canal (WhatsApp: wa_id del cliente). */
  to: string;
}

export interface ExecuteDecisionResult {
  executedActions: number;
}

export class ExecuteDecision {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly decisions: DecisionRepository,
    private readonly events: EventRepository,
    private readonly sender: MessageSender,
  ) {}

  async execute(input: ExecuteDecisionInput): Promise<ExecuteDecisionResult> {
    const decision = await this.decisions.findById(Identity.of(input.decisionId));
    if (!decision) {
      throw new DomainError("ExecuteDecision: la Decision no existe");
    }

    let executed = 0;
    for (const action of decision.actions) {
      if (action.type !== "message.send") continue;
      const text = typeof action.params.text === "string" ? action.params.text : "";
      if (!text) continue;

      const result = await this.sender.send({
        binding: input.binding,
        to: input.to,
        text,
      });

      await this.events.append(
        Event.create(this.ids.next(), {
          sessionId: decision.sessionId,
          type: "message.sent",
          occurredAt: this.clock.now(),
          payload: {
            decisionId: decision.id.toString(),
            to: input.to,
            text,
            externalMessageId: result.externalMessageId,
          },
        }),
      );
      executed += 1;
    }

    return { executedActions: executed };
  }
}
