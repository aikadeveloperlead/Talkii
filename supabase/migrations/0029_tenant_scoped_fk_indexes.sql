-- Seguimiento de 0028: las FKs compuestas (col, tenant_id) necesitan un indice
-- cubridor propio. Verificado con `get_advisors performance` tras aplicar 0028:
-- las 5 aparecieron como `unindexed_foreign_keys`.
--
-- Los indices de una sola columna que ya existian quedan REDUNDANTES y se
-- eliminan: un indice compuesto (a, b) cubre por prefijo cualquier consulta
-- sobre (a) sola, asi que no se pierde ningun plan — se evita mantener dos
-- indices para lo mismo (doble coste de escritura por fila insertada).

create index if not exists channel_bindings_agent_tenant_idx
  on public.channel_bindings(agent_id, tenant_id);
drop index if exists public.channel_bindings_agent_id_idx;

create index if not exists channel_bindings_funnel_tenant_idx
  on public.channel_bindings(funnel_id, tenant_id);
drop index if exists public.channel_bindings_funnel_id_idx;

create index if not exists agents_funnel_tenant_idx
  on public.agents(funnel_id, tenant_id);
drop index if exists public.agents_funnel_id_idx;

create index if not exists appointments_customer_tenant_idx
  on public.appointments(customer_id, tenant_id);
drop index if exists public.appointments_customer_id_idx;

create index if not exists appointments_conversation_tenant_idx
  on public.appointments(conversation_id, tenant_id);
-- appointments_conversation_id_idx se creo en 0012_fk_indexes.sql.
drop index if exists public.appointments_conversation_id_idx;
