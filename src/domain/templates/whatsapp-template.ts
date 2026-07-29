import { Entity, Identity, invariant } from "../shared";

/**
 * WhatsAppTemplate — Entidad del bounded context Templates (SCR-006).
 *
 * "La fuente oficial del estado de aprobación siempre será Meta. Talkii
 * mantiene una copia sincronizada" (SCR-006 §1). Sin credenciales reales de
 * Meta ni spec de API concreta (el documento de implementación no expone
 * "Backend involucrado"/"APIs" para este módulo — solo el modelo conceptual),
 * esta entidad cubre únicamente el ciclo Draft→Editing local. Los estados
 * sincronizados desde Meta (approved/rejected/paused/disabled) y la
 * sincronización en sí quedan fuera de esta pasada (AA-03: no se implementa
 * integración externa sin evidencia concreta de su contrato).
 */
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";
export type QualityRating = "high" | "medium" | "low" | "unknown";

export interface TemplateButton {
  readonly type: string;
  readonly text: string;
  readonly value?: string;
}

export interface TemplateComponents {
  readonly headerType?: "text" | "image" | "video" | "document" | "location";
  readonly headerContent?: string;
  readonly body: string;
  readonly footer?: string;
  readonly buttons: TemplateButton[];
}

export interface WhatsAppTemplateProps {
  tenantId: Identity;
  name: string;
  language: string;
  category: TemplateCategory;
  components: TemplateComponents;
  status: TemplateStatus;
  qualityRating?: QualityRating;
  version: number;
  archivedAt?: Date;
}

export class WhatsAppTemplate extends Entity {
  private constructor(
    id: Identity,
    private readonly props: WhatsAppTemplateProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: WhatsAppTemplateProps): WhatsAppTemplate {
    invariant(props.name.trim().length > 0, "WhatsAppTemplate: el nombre no puede estar vacío");
    invariant(props.language.trim().length > 0, "WhatsAppTemplate: debe declarar un idioma");
    invariant(
      props.components.body.trim().length > 0,
      "WhatsAppTemplate: el Body no puede estar vacío",
    );
    invariant(props.version >= 1, "WhatsAppTemplate: la versión debe ser >= 1");
    return new WhatsAppTemplate(id, {
      ...props,
      name: props.name.trim(),
      components: { ...props.components, buttons: [...props.components.buttons] },
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get name(): string {
    return this.props.name;
  }
  get language(): string {
    return this.props.language;
  }
  get category(): TemplateCategory {
    return this.props.category;
  }
  get components(): TemplateComponents {
    return this.props.components;
  }
  get status(): TemplateStatus {
    return this.props.status;
  }
  get qualityRating(): QualityRating | undefined {
    return this.props.qualityRating;
  }
  get version(): number {
    return this.props.version;
  }
  get archivedAt(): Date | undefined {
    return this.props.archivedAt;
  }
  get isArchived(): boolean {
    return this.props.archivedAt !== undefined;
  }
  get isEditable(): boolean {
    return this.props.status === "draft";
  }

  withEdits(changes: Partial<Pick<WhatsAppTemplateProps, "name" | "category" | "components">>): WhatsAppTemplate {
    return WhatsAppTemplate.create(this.id, { ...this.props, ...changes });
  }

  archived(): WhatsAppTemplate {
    return WhatsAppTemplate.create(this.id, { ...this.props, archivedAt: new Date() });
  }
}
