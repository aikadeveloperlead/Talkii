-- Items MEDIO #9/#10 de la auditoria: SupabaseReportsRepository no tenia
-- GROUP BY nativo via PostgREST, asi que getLeadsByStatus/getAppointmentsByStatus
-- resolvian con N queries en paralelo (una por valor de status). Se agregan 2
-- funciones que agrupan en el servidor, colapsando N round-trips a 1 por
-- reporte.
--
-- security invoker (no definer): estas funciones corren via el cliente
-- RLS-scoped de cada request (requireTenantContainer), no via service-role —
-- que corran con el rol del caller es lo correcto: RLS sobre leads/customers/
-- appointments sigue aplicando como defensa en profundidad aunque p_tenant_id
-- viniera mal, a diferencia de increment_rate_limit (0022) que si necesitaba
-- bypassear RLS a proposito.

create or replace function public.count_leads_by_status(p_tenant_id uuid)
returns table(status text, count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select l.status, count(*)::integer
  from public.leads l
  join public.customers c on c.id = l.customer_id
  where c.tenant_id = p_tenant_id
  group by l.status;
$$;

create or replace function public.count_appointments_by_status(p_tenant_id uuid)
returns table(status text, count integer)
language sql
stable
security invoker
set search_path = public
as $$
  select a.status, count(*)::integer
  from public.appointments a
  where a.tenant_id = p_tenant_id and a.deleted_at is null
  group by a.status;
$$;
