import { Entity, Identity, invariant } from "../shared";

/**
 * Tenant — Entidad Raíz del Dominio (SSOT Cap. 7 §4). SCR-012 §3.2 la llama
 * "Workspace" desde la UI — mismo concepto, un solo Tenant por instancia.
 *
 * Representa a la organización propietaria de una instancia lógica de Talkii.
 * Es el principal límite de aislamiento: todo recurso operativo pertenece a un
 * único Tenant.
 *
 * Límites: el Tenant nunca participa en una conversación, no interpreta eventos
 * ni toma decisiones.
 *
 * SCR-012 añade description/logo/status (opcionales, mismo patrón que Agent
 * en SCR-008). Deliberadamente NO incluye Users/Roles/Security: la
 * arquitectura de auth actual es 1 usuario Supabase ↔ 1 tenant_id (asignado
 * una vez en onboarding, sin invitaciones ni roles) — construir un CRUD de
 * Usuarios/Roles ahora simularía control de acceso que no se aplica en
 * ningún lado (ninguna ruta valida "Owner"/"Admin"), lo cual es peor que no
 * tenerlo. Requiere una pasada de diseño dedicada a multi-usuario-por-tenant
 * antes de construirse (AA-03).
 */
export type WorkspaceStatus = "active" | "suspended" | "archived";

export interface TenantProps {
  name: string;
  description?: string;
  logo?: string;
  status?: WorkspaceStatus;
  /**
   * Usuario de auth que aprovisionó esta organización. Hace explícita una
   * relación que antes solo existía como claim en el JWT — sin ella, un Tenant
   * creado por un doble submit del onboarding quedaba huérfano e inalcanzable
   * (hallazgo MEDIUM de la auditoría santa-loop). Único en la BD.
   */
  ownerUserId?: string;
}

export class Tenant extends Entity {
  private constructor(
    id: Identity,
    private readonly props: TenantProps & { status: WorkspaceStatus },
  ) {
    super(id);
  }

  static create(id: Identity, props: TenantProps): Tenant {
    invariant(
      props.name.trim().length > 0,
      "Tenant: el nombre no puede estar vacío",
    );
    return new Tenant(id, {
      ...props,
      name: props.name.trim(),
      status: props.status ?? "active",
    });
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get logo(): string | undefined {
    return this.props.logo;
  }

  get status(): WorkspaceStatus {
    return this.props.status;
  }

  get ownerUserId(): string | undefined {
    return this.props.ownerUserId;
  }

  withEdits(changes: Partial<Pick<TenantProps, "name" | "description" | "logo">>): Tenant {
    return Tenant.create(this.id, { ...this.props, ...changes });
  }

  withStatus(status: WorkspaceStatus): Tenant {
    return Tenant.create(this.id, { ...this.props, status });
  }
}
