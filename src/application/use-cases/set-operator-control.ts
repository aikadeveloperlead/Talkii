import { DomainError, Identity } from "@/domain";
import { SessionRepository } from "../ports/repositories";

/**
 * SetOperatorControl — intervención humana sobre el Runtime (SCR-002 §7
 * POST /conversation/intervention y POST /conversation/return-agent, Estado 8).
 *
 * `operatorControl` es una bandera operativa sin identidad propia (SSOT
 * Cap. 7 §11 excluye estas dimensiones como entidades), expuesta vía
 * `Session.operatorControl`/`withOperatorControl`, no una entidad nueva.
 * HandleInboundMessage la respeta para dejar de decidir automáticamente
 * mientras un operador tiene el control.
 */
export interface SetOperatorControlInput {
  conversationId: string;
  enabled: boolean;
}

export class SetOperatorControl {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(input: SetOperatorControlInput): Promise<void> {
    const session = await this.sessions.findActiveByConversation(
      Identity.of(input.conversationId),
    );
    if (!session) {
      throw new DomainError(
        "SetOperatorControl: no hay Session activa para la Conversation",
      );
    }

    await this.sessions.save(session.withOperatorControl(input.enabled));
  }
}
