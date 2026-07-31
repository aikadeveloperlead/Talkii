-- Hallazgo HIGH de la auditoria adversarial santa-loop: varias FKs referencian
-- solo `(id)` de la tabla destino, sin correlacionar el tenant. Como las FKs se
-- validan a nivel de sistema (RLS NO aplica a la verificacion de una FK), una
-- fila podia apuntar legitimamente a una entidad de OTRO tenant.
--
-- El caso mas concreto (reportado por el revisor A): `channel_bindings.agent_id`
-- referencia `agents(id)` globalmente. Un tenant que conociera el UUID de un
-- Agent ajeno podia apuntar su binding a el; como el webhook de WhatsApp corre
-- con service-role (salta RLS), MakeDecision cargaba ese Agent y filtraba su
-- `permanent_prompt`, `business_description` y mensajes configurados. El
-- 0025 ya cerro la escritura directa a channel_bindings, pero la integridad
-- referencial cross-tenant seguia sin garantizarse a nivel de schema — y las
-- otras cuatro FKs si son escribibles por caminos normales de la app.
--
-- Solucion estandar: clave unica (id, tenant_id) en la tabla destino (redundante
-- con la PK pero necesaria como destino de una FK compuesta) + FK compuesta que
-- arrastra tenant_id. Postgres exige entonces que ambas columnas casen, lo que
-- hace IMPOSIBLE una referencia cross-tenant, sin depender de que la aplicacion
-- se acuerde de validarlo.
--
-- Verificado que las 6 tablas involucradas estan vacias antes de aplicar, asi
-- que no hay filas preexistentes que pudieran violar las nuevas constraints.

-- ── Claves unicas destino ────────────────────────────────────────────────────
alter table public.agents
  add constraint agents_id_tenant_key unique (id, tenant_id);
alter table public.funnels
  add constraint funnels_id_tenant_key unique (id, tenant_id);
alter table public.customers
  add constraint customers_id_tenant_key unique (id, tenant_id);
alter table public.conversations
  add constraint conversations_id_tenant_key unique (id, tenant_id);

-- ── channel_bindings → agents / funnels ──────────────────────────────────────
alter table public.channel_bindings
  drop constraint if exists channel_bindings_agent_id_fkey;
alter table public.channel_bindings
  add constraint channel_bindings_agent_same_tenant
  foreign key (agent_id, tenant_id) references public.agents(id, tenant_id)
  on delete cascade;

alter table public.channel_bindings
  drop constraint if exists channel_bindings_funnel_id_fkey;
alter table public.channel_bindings
  add constraint channel_bindings_funnel_same_tenant
  foreign key (funnel_id, tenant_id) references public.funnels(id, tenant_id)
  on delete set null;

-- ── agents → funnels ─────────────────────────────────────────────────────────
alter table public.agents
  drop constraint if exists agents_funnel_id_fkey;
alter table public.agents
  add constraint agents_funnel_same_tenant
  foreign key (funnel_id, tenant_id) references public.funnels(id, tenant_id)
  on delete set null;

-- ── appointments → customers / conversations ─────────────────────────────────
alter table public.appointments
  drop constraint if exists appointments_customer_id_fkey;
alter table public.appointments
  add constraint appointments_customer_same_tenant
  foreign key (customer_id, tenant_id) references public.customers(id, tenant_id)
  on delete set null;

alter table public.appointments
  drop constraint if exists appointments_conversation_id_fkey;
alter table public.appointments
  add constraint appointments_conversation_same_tenant
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id)
  on delete set null;
