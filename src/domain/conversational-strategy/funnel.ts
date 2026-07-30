import { Entity, Identity, invariant } from "../shared";

/**
 * FunnelStage — Objeto de Valor: una etapa declarativa del funnel. Describe
 * objetivo y criterio de transición; nunca ejecuta comportamiento.
 *
 * SCR-010 §5.2 añade stepKey/order/nextStep/status (todos opcionales, para no
 * romper la invariante existente ni los call-sites de tests). Cuando se
 * proveen, BK-03/BK-04 (order y stepKey únicos dentro del Funnel) se validan
 * en `Funnel.create`.
 */
export interface FunnelStage {
  readonly name: string;
  readonly objective: string;
  readonly transitionCriteria: string;
  readonly stepKey?: string;
  readonly order?: number;
  readonly nextStep?: string;
  readonly status?: "active" | "disabled";
}

export type FunnelStatus = "draft" | "active" | "archived";

/**
 * Funnel — Entidad Estratégica (SSOT Cap. 7 §10).
 *
 * Representa una estrategia declarativa de evolución conversacional: define
 * etapas, objetivos y criterios de transición. Representa el proceso comercial.
 *
 * Invariantes (SSOT §10): el Funnel nunca interpreta Events, nunca toma
 * Decisions y nunca gobierna contexto ni memoria. ÚNICAMENTE describe
 * estrategia — por eso esta entidad no expone métodos de comportamiento.
 *
 * SCR-010 añade description/adsAttribution/status (opcionales).
 * Deliberadamente NO incluye ejecución del Funnel, motor de decisión ni el
 * "Workflow genérico de n8n" del spec (n8n removido de la arquitectura de
 * Talkii — el Decision Engine, SSOT Cap. 11, es su reemplazo).
 */
export interface FunnelProps {
  tenantId: Identity;
  name: string;
  stages: FunnelStage[];
  description?: string;
  adsAttribution?: boolean;
  status?: FunnelStatus;
}

export class Funnel extends Entity {
  private constructor(
    id: Identity,
    private readonly props: FunnelProps & { adsAttribution: boolean; status: FunnelStatus },
  ) {
    super(id);
  }

  static create(id: Identity, props: FunnelProps): Funnel {
    invariant(
      props.name.trim().length > 0,
      "Funnel: el nombre no puede estar vacío",
    );
    invariant(
      props.stages.length > 0,
      "Funnel: debe declarar al menos una etapa",
    );

    const orders = props.stages.map((s) => s.order).filter((o): o is number => o !== undefined);
    invariant(
      new Set(orders).size === orders.length,
      "Funnel: el orden de los pasos no puede repetirse (BK-03)",
    );
    const keys = props.stages.map((s) => s.stepKey).filter((k): k is string => k !== undefined);
    invariant(
      new Set(keys).size === keys.length,
      "Funnel: el ID del paso debe ser único dentro del Funnel (BK-04)",
    );

    return new Funnel(id, {
      ...props,
      name: props.name.trim(),
      stages: [...props.stages],
      adsAttribution: props.adsAttribution ?? false,
      status: props.status ?? "draft",
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get stages(): readonly FunnelStage[] {
    return this.props.stages;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get adsAttribution(): boolean {
    return this.props.adsAttribution;
  }

  get status(): FunnelStatus {
    return this.props.status;
  }

  withStages(stages: FunnelStage[]): Funnel {
    return Funnel.create(this.id, { ...this.props, stages });
  }

  withEdits(changes: Partial<Pick<FunnelProps, "name" | "description" | "adsAttribution">>): Funnel {
    return Funnel.create(this.id, { ...this.props, ...changes });
  }

  withStatus(status: FunnelStatus): Funnel {
    return Funnel.create(this.id, { ...this.props, status });
  }
}
