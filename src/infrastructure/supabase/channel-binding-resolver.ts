import type { SupabaseClient } from "@supabase/supabase-js";
import { ChannelBinding, Identity, type Channel } from "@/domain";
import type { ChannelBindingResolver } from "@/application/ports";
import { decryptToken } from "../security/token-cipher";

/** Fila de public.channel_bindings (migración 0002). `access_token` guarda el texto cifrado (token-cipher.ts, hallazgo MEDIO de auditoría). */
interface ChannelBindingRow {
  id: string;
  tenant_id: string;
  channel: Channel;
  external_id: string;
  agent_id: string;
  funnel_id: string | null;
  access_token: string | null;
}

function rowToBinding(row: ChannelBindingRow): ChannelBinding {
  let accessToken: string | undefined;
  if (row.access_token) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        "SupabaseChannelBindingResolver: falta ENCRYPTION_KEY en el entorno para descifrar access_token.",
      );
    }
    accessToken = decryptToken(row.access_token, key);
  }
  return ChannelBinding.create(Identity.of(row.id), {
    tenantId: Identity.of(row.tenant_id),
    channel: row.channel,
    externalId: row.external_id,
    agentId: Identity.of(row.agent_id),
    funnelId: row.funnel_id ? Identity.of(row.funnel_id) : undefined,
    accessToken,
  });
}

export class SupabaseChannelBindingResolver implements ChannelBindingResolver {
  constructor(private readonly db: SupabaseClient) {}

  async findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null> {
    const { data, error } = await this.db
      .from("channel_bindings")
      .select("id,tenant_id,channel,external_id,agent_id,funnel_id,access_token")
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase channel_bindings.select: ${error.message}`);
    }
    return data ? rowToBinding(data as ChannelBindingRow) : null;
  }

  async findByTenant(
    tenantId: string,
    channel: Channel,
  ): Promise<ChannelBinding | null> {
    const { data, error } = await this.db
      .from("channel_bindings")
      .select("id,tenant_id,channel,external_id,agent_id,funnel_id,access_token")
      .eq("tenant_id", tenantId)
      .eq("channel", channel)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase channel_bindings.select: ${error.message}`);
    }
    return data ? rowToBinding(data as ChannelBindingRow) : null;
  }
}
