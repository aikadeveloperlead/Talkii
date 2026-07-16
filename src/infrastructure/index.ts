// ── Adaptadores de puertos técnicos ──
export { SystemClock } from "./time/system-clock";
export { UuidIdGenerator } from "./id/uuid-id-generator";

// ── Supabase: cliente + repositorios ──
export {
  createSupabaseClient,
  createServiceClient,
  type SupabaseClientOptions,
} from "./supabase/client";
export {
  SupabaseTenantRepository,
  SupabaseAgentRepository,
  SupabaseFunnelRepository,
  SupabaseConversationRepository,
  SupabaseSessionRepository,
  SupabaseEventRepository,
  SupabaseDecisionRepository,
} from "./supabase/repositories";
