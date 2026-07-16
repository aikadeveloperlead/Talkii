import { Entity, Identity, invariant } from "../shared";

/**
 * Tenant — Entidad Raíz del Dominio (SSOT Cap. 7 §4).
 *
 * Representa a la organización propietaria de una instancia lógica de Talkii.
 * Es el principal límite de aislamiento: todo recurso operativo pertenece a un
 * único Tenant.
 *
 * Límites: el Tenant nunca participa en una conversación, no interpreta eventos
 * ni toma decisiones.
 */
export interface TenantProps {
  name: string;
}

export class Tenant extends Entity {
  private constructor(
    id: Identity,
    private readonly props: TenantProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: TenantProps): Tenant {
    invariant(
      props.name.trim().length > 0,
      "Tenant: el nombre no puede estar vacío",
    );
    return new Tenant(id, { name: props.name.trim() });
  }

  get name(): string {
    return this.props.name;
  }
}
