-- Item MEDIO #12 de la auditoria: busqueda de clientes sin pg_trgm (ILIKE
-- '%term%' sin indice de soporte, full scan) y paginacion por OFFSET (range()
-- en SupabaseCustomerRepository.search — se degrada con el tamaño de la
-- tabla: cada pagina re-escanea y descarta N filas previas).
--
-- pg_trgm instalado directo en schema `extensions` (no `public`) — la
-- sesion anterior tuvo que corregir btree_gist despues (0013->0014) por
-- instalarla sin schema explicito; se aplica esa leccion aqui desde el
-- inicio.

create extension if not exists pg_trgm with schema extensions;

create index if not exists customers_first_name_trgm_idx
  on public.customers using gin (first_name extensions.gin_trgm_ops);
create index if not exists customers_last_name_trgm_idx
  on public.customers using gin (last_name extensions.gin_trgm_ops);
create index if not exists customers_phone_trgm_idx
  on public.customers using gin (phone extensions.gin_trgm_ops);
create index if not exists customers_email_trgm_idx
  on public.customers using gin (email extensions.gin_trgm_ops);

-- Soporte para el keyset/cursor pagination (order by created_at desc, id desc
-- + predicado de continuacion) que reemplaza range()/OFFSET en
-- SupabaseCustomerRepository.search.
create index if not exists customers_tenant_created_id_idx
  on public.customers(tenant_id, created_at desc, id desc);
