import { Entity, Identity, invariant } from "../shared";

/**
 * KnowledgeDocument — Entidad del bounded context Knowledge (SCR-009).
 *
 * "La implementación del motor de embeddings pertenece al documento de n8n"
 * (SCR-009 §5.4) — n8n no forma parte de la arquitectura de Talkii. Esta
 * entidad cubre el ciclo de vida del documento (BK-01 a BK-04); la
 * sincronización real (generar embeddings, quedar "synced") requiere un
 * motor de embeddings que no está construido — AA-03: no se implementa
 * integración externa sin evidencia concreta de su contrato.
 */
export type KnowledgeSourceType = "text" | "file" | "url";
export type KnowledgeStatus = "draft" | "pending" | "processing" | "synced" | "error" | "archived";

export interface KnowledgeDocumentProps {
  tenantId: Identity;
  title: string;
  categoryId?: Identity;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceFile?: string;
  status: KnowledgeStatus;
  isActive: boolean;
}

export class KnowledgeDocument extends Entity {
  private constructor(
    id: Identity,
    private readonly props: KnowledgeDocumentProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: KnowledgeDocumentProps): KnowledgeDocument {
    invariant(props.title.trim().length > 0, "KnowledgeDocument: el título no puede estar vacío");
    invariant(
      props.content.trim().length > 0,
      "KnowledgeDocument: el contenido no puede estar vacío",
    );
    return new KnowledgeDocument(id, { ...props, title: props.title.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get title(): string {
    return this.props.title;
  }
  get categoryId(): Identity | undefined {
    return this.props.categoryId;
  }
  get content(): string {
    return this.props.content;
  }
  get sourceType(): KnowledgeSourceType {
    return this.props.sourceType;
  }
  get sourceFile(): string | undefined {
    return this.props.sourceFile;
  }
  get status(): KnowledgeStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }

  /** BK-03: editar un documento lo regresa a "pending". */
  withEdits(changes: Partial<Pick<KnowledgeDocumentProps, "title" | "categoryId" | "content">>): KnowledgeDocument {
    return KnowledgeDocument.create(this.id, { ...this.props, ...changes, status: "pending" });
  }

  archived(): KnowledgeDocument {
    return KnowledgeDocument.create(this.id, { ...this.props, status: "archived", isActive: false });
  }
}
