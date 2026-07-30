import { Entity, Identity, invariant } from "../shared";

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
    const merged = { ...DEFAULTS, ...defined };
    invariant(merged.language.trim().length > 0, "Preferences: language no puede estar vacío");
    invariant(merged.timezone.trim().length > 0, "Preferences: timezone no puede estar vacío");
    invariant(merged.currency.trim().length > 0, "Preferences: currency no puede estar vacío");
    invariant(merged.dateFormat.trim().length > 0, "Preferences: dateFormat no puede estar vacío");
    return new Preferences(id, merged);
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
