import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/domain";
import type {
  ChannelBinding,
  ChannelBindingResolver,
} from "@/application/ports";

/** Fila de public.channel_bindings (migración 0002). */
interface ChannelBindingRow {
  tenant_id: string;
  channel: Channel;
  external_id: string;
  agent_id: string;
  funnel_id: string | null;
  access_token: string | null;
}

function rowToBinding(row: ChannelBindingRow): ChannelBinding {
  return {
    tenantId: row.tenant_id,
    channel: row.channel,
    externalId: row.external_id,
    agentId: row.agent_id,
    funnelId: row.funnel_id ?? undefined,
    accessToken: row.access_token ?? undefined,
  };
}

export class SupabaseChannelBindingResolver implements ChannelBindingResolver {
  constructor(private readonly db: SupabaseClient) {}

  async findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null> {
    const { data, error } = await this.db
      .from("channel_bindings")
      .select("*")
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase channel_bindings.select: ${error.message}`);
    }
    return data ? rowToBinding(data as ChannelBindingRow) : null;
  }
}
