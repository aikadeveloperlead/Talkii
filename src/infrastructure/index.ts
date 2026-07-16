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

// ── Razonamiento + Decision Engine (AA-02) ──
export { ReasoningBackedDecisionEngine } from "./decision/reasoning-backed-decision-engine";
export {
  AnthropicReasoningProvider,
  type AnthropicOptions,
} from "./reasoning/anthropic-reasoning-provider";
