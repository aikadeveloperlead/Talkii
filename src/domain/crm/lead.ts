import { Entity, Identity, invariant } from "../shared";

/**
 * Lead — Entidad del bounded context CRM (SCR-003), separada de Customer.
 *
 * Administra el estado COMERCIAL de la relación ("Lead Service: nunca
 * administra datos personales" — SCR-003 §5). Todo Customer nuevo recibe un
 * Lead inicial (SCR-003 Trigger 2: "Nuevo Cliente → Crear Lead").
 */
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export interface LeadProps {
  customerId: Identity;
  status: LeadStatus;
  score: number;
  priority?: string;
  ownerId?: string;
}

export class Lead extends Entity {
  private constructor(
    id: Identity,
    private readonly props: LeadProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: LeadProps): Lead {
    invariant(
      Number.isFinite(props.score) && props.score >= 0,
      "Lead: el score debe ser un número >= 0",
    );
    return new Lead(id, { ...props });
  }

  get customerId(): Identity {
    return this.props.customerId;
  }

  get status(): LeadStatus {
    return this.props.status;
  }

  get score(): number {
    return this.props.score;
  }

  get priority(): string | undefined {
    return this.props.priority;
  }

  get ownerId(): string | undefined {
    return this.props.ownerId;
  }

  withStatus(status: LeadStatus): Lead {
    return Lead.create(this.id, { ...this.props, status });
  }

  withScore(score: number): Lead {
    return Lead.create(this.id, { ...this.props, score });
  }
}
