-- Item MEDIO #13 de la auditoria: rate limiting via tabla persistente en
-- Supabase (decision explicita del usuario — no in-memory, compartido entre
-- instancias, mismo patron que el resto del proyecto). Ventana fija: cada
-- (key, window_start) es un contador independiente; el caller calcula
-- window_start alineado al tamaño de ventana antes de llamar al RPC.

create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 1,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits(window_start);

-- RLS activa sin policies: solo accesible via service-role (bypassa RLS),
-- igual que channel_bindings para el webhook de WhatsApp. El rate limiter se
-- aplica ANTES de que exista sesión (login/signup), no hay JWT de usuario
-- del que derivar una policy con sentido.
alter table public.rate_limits enable row level security;

-- Incremento atomico (evita race condition de leer-luego-escribir en la
-- app): un solo upsert, retorna el contador ya incrementado. search_path
-- explicito (mismo fix ya aplicado a current_tenant_id() en 0020, evita
-- reintroducir el WARN function_search_path_mutable).
create or replace function public.increment_rate_limit(
  p_key text,
  p_window_start timestamptz
) returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = rate_limits.count + 1
  returning count;
$$;

-- SECURITY DEFINER + expuesto por PostgREST significa que, sin este revoke,
-- CUALQUIER anon/authenticated podria llamar /rest/v1/rpc/increment_rate_limit
-- directo y manipular contadores de otros keys (incluidos los de otros
-- usuarios) sin pasar por checkRateLimit(). Solo el service-role (usado por
-- app/_lib/rate-limit.ts) debe poder invocarlo.
revoke execute on function public.increment_rate_limit(text, timestamptz)
  from public, anon, authenticated;
