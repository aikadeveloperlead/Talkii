import { Entity, Identity, invariant } from "../shared";

/** Category — Entidad del bounded context Knowledge (SCR-009 §5.2). */
export interface CategoryProps {
  tenantId: Identity;
  name: string;
  color?: string;
}

export class Category extends Entity {
  private constructor(
    id: Identity,
    private readonly props: CategoryProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: CategoryProps): Category {
    invariant(props.name.trim().length > 0, "Category: el nombre no puede estar vacío");
    return new Category(id, { ...props, name: props.name.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get name(): string {
    return this.props.name;
  }
  get color(): string | undefined {
    return this.props.color;
  }
}
