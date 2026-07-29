import { Entity, Identity } from "../shared";

/** Preferences — preferencias globales del Tenant (SCR-012 §5.5, 1:1 con Tenant). */
export interface PreferencesProps {
  tenantId: Identity;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
}

const DEFAULTS = {
  language: "es",
  timezone: "UTC",
  currency: "USD",
  dateFormat: "DD/MM/YYYY",
};

export class Preferences extends Entity {
  private constructor(
    id: Identity,
    private readonly props: PreferencesProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: Partial<PreferencesProps> & { tenantId: Identity }): Preferences {
    // Filtra claves explícitamente `undefined` antes de fusionar con los
    // defaults: un spread directo las conservaría y pisaría el default
    // (mismo bug ya encontrado en UpdateKnowledgeDocument esta sesión).
    const defined = Object.fromEntries(
      Object.entries(props).filter(([, value]) => value !== undefined),
    ) as Partial<PreferencesProps> & { tenantId: Identity };
    return new Preferences(id, { ...DEFAULTS, ...defined });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get language(): string {
    return this.props.language;
  }
  get timezone(): string {
    return this.props.timezone;
  }
  get currency(): string {
    return this.props.currency;
  }
  get dateFormat(): string {
    return this.props.dateFormat;
  }

  withEdits(changes: Partial<Omit<PreferencesProps, "tenantId">>): Preferences {
    return Preferences.create(this.id, { ...this.props, ...changes });
  }
}
