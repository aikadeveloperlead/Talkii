import { Entity, Identity, invariant } from "../shared";

/**
 * FunnelStage — Objeto de Valor: una etapa declarativa del funnel. Describe
 * objetivo y criterio de transición; nunca ejecuta comportamiento.
 */
export interface FunnelStage {
  readonly name: string;
  readonly objective: string;
  readonly transitionCriteria: string;
}

/**
 * Funnel — Entidad Estratégica (SSOT Cap. 7 §10).
 *
 * Representa una estrategia declarativa de evolución conversacional: define
 * etapas, objetivos y criterios de transición. Representa el proceso comercial.
 *
 * Invariantes (SSOT §10): el Funnel nunca interpreta Events, nunca toma
 * Decisions y nunca gobierna contexto ni memoria. ÚNICAMENTE describe
 * estrategia — por eso esta entidad no expone métodos de comportamiento.
 */
export interface FunnelProps {
  tenantId: Identity;
  name: string;
  stages: FunnelStage[];
}

export class Funnel extends Entity {
  private constructor(
    id: Identity,
    private readonly props: FunnelProps,
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
    return new Funnel(id, {
      ...props,
      name: props.name.trim(),
      stages: [...props.stages],
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
}
