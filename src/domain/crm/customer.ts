import { Entity, Identity, invariant } from "../shared";

/**
 * Customer — Entidad del bounded context CRM (SCR-003).
 *
 * NO forma parte de las 7 entidades fundamentales del SSOT Cap. 7 (ese
 * inventario permanece cerrado). El Documento Maestro del Dominio modela
 * "gestionar clientes" como una Tool/capability (`UpdateCustomer`) que admite
 * varias implementaciones — HubSpot, Salesforce, Zoho, o "CRM propietario".
 * Customer es la entidad que materializa esa implementación propietaria: el
 * dominio nunca depende de ella directamente (AA-02 se preserva porque la
 * dependencia sigue siendo la Tool abstracta, no esta clase).
 *
 * Tags viven inline como Objeto de Valor (array de nombres), igual que
 * `Agent.policies` o `Conversation.participants` — no ameritan su propia
 * tabla relacional para esta fase.
 */
export interface CustomerProps {
  tenantId: Identity;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  city?: string;
  country?: string;
  tags: string[];
  archivedAt?: Date;
}

export class Customer extends Entity {
  private constructor(
    id: Identity,
    private readonly props: CustomerProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: CustomerProps): Customer {
    invariant(
      props.firstName.trim().length > 0,
      "Customer: el nombre no puede estar vacío",
    );
    invariant(
      Boolean(props.phone?.trim() || props.email?.trim()),
      "Customer: debe tener al menos un teléfono o un correo",
    );
    return new Customer(id, {
      ...props,
      firstName: props.firstName.trim(),
      tags: [...props.tags],
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string | undefined {
    return this.props.lastName;
  }

  get fullName(): string {
    return [this.props.firstName, this.props.lastName].filter(Boolean).join(" ");
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get company(): string | undefined {
    return this.props.company;
  }

  get position(): string | undefined {
    return this.props.position;
  }

  get city(): string | undefined {
    return this.props.city;
  }

  get country(): string | undefined {
    return this.props.country;
  }

  get tags(): readonly string[] {
    return this.props.tags;
  }

  get archivedAt(): Date | undefined {
    return this.props.archivedAt;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== undefined;
  }

  /** Reconstruye el Customer con datos básicos actualizados (SCR-003 PUT /customers/:id). */
  withUpdatedProfile(
    changes: Partial<
      Pick<
        CustomerProps,
        | "firstName"
        | "lastName"
        | "phone"
        | "email"
        | "company"
        | "position"
        | "city"
        | "country"
      >
    >,
  ): Customer {
    return Customer.create(this.id, { ...this.props, ...changes });
  }

  withTags(tags: string[]): Customer {
    return Customer.create(this.id, { ...this.props, tags });
  }

  archived(): Customer {
    return Customer.create(this.id, { ...this.props, archivedAt: new Date() });
  }
}
