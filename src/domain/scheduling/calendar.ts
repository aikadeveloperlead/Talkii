import { Entity, Identity, invariant } from "../shared";

/**
 * Calendar — Entidad del bounded context Scheduling (SCR-004 Agenda).
 * Igual que Customer (CRM), no forma parte de las 7 entidades núcleo del
 * SSOT Cap.7: es infraestructura de configuración del Tenant necesaria para
 * que Appointment tenga dónde vivir (AA-01: sin Calendar no hay forma válida
 * de crear una reunión — persistencia justificada por esa necesidad).
 */
export interface CalendarProps {
  tenantId: Identity;
  name: string;
  timezone: string;
  color?: string;
  isDefault: boolean;
}

export class Calendar extends Entity {
  private constructor(
    id: Identity,
    private readonly props: CalendarProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: CalendarProps): Calendar {
    invariant(props.name.trim().length > 0, "Calendar: el nombre no puede estar vacío");
    invariant(
      props.timezone.trim().length > 0,
      "Calendar: debe declarar una zona horaria",
    );
    return new Calendar(id, { ...props, name: props.name.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get color(): string | undefined {
    return this.props.color;
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }
}
