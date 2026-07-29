import { Entity, Identity, invariant } from "../shared";

/** Company — información legal/comercial del Tenant (SCR-012 §5.2, 1:1 con Tenant). */
export interface CompanyProps {
  tenantId: Identity;
  businessName: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export class Company extends Entity {
  private constructor(
    id: Identity,
    private readonly props: CompanyProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: CompanyProps): Company {
    invariant(
      props.businessName.trim().length > 0,
      "Company: el nombre comercial no puede estar vacío",
    );
    return new Company(id, { ...props, businessName: props.businessName.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get businessName(): string {
    return this.props.businessName;
  }
  get legalName(): string | undefined {
    return this.props.legalName;
  }
  get taxId(): string | undefined {
    return this.props.taxId;
  }
  get email(): string | undefined {
    return this.props.email;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get website(): string | undefined {
    return this.props.website;
  }

  withEdits(changes: Partial<Omit<CompanyProps, "tenantId">>): Company {
    return Company.create(this.id, { ...this.props, ...changes });
  }
}
