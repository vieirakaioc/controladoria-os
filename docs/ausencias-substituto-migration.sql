-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- MIGRAÇÃO: ausencias — adicionar coluna substituto_id
-- =============================================================================
--
-- O QUE FAZ:
--   Permite que ao cadastrar uma ausência, o admin/colaborador escolha quem
--   COBRE as tarefas durante o período. As tarefas com data_vencimento dentro
--   do período são REDIRECIONADAS pro substituto no cálculo do score.
--
--   Se substituto_id ficar null, as tarefas simplesmente não contam (comporta-
--   mento atual).
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser.
-- =============================================================================

alter table public.ausencias
  add column if not exists substituto_id bigint references public.responsaveis(id) on delete set null;

comment on column public.ausencias.substituto_id is 'Quem cobre as tarefas durante a ausência. NULL = tarefas não contam pra ninguém. Set null on delete pra não excluir a ausência se o substituto sair da empresa.';

-- ─── Tornar a tabela pública pra membros (cada um cadastra a própria) ──────
-- Roda os drops + recreate idempotentes pra subir as policies novas
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ausencias'
  loop
    execute format('drop policy if exists %I on public.ausencias', pol.policyname);
  end loop;
end$$;

-- SELECT: todos autenticados (Monitor + página de férias precisam ler)
create policy "ausencias_read_all"
  on public.ausencias for select
  to authenticated
  using (true);

-- INSERT: o próprio (mapeado pelo email) OU admin
create policy "ausencias_insert_own_or_admin"
  on public.ausencias for insert
  to authenticated
  with check (
    public.current_user_is_admin()
    or responsavel_id in (
      select id from public.responsaveis
      where lower(email) = lower(auth.email())
    )
  );

-- UPDATE: o próprio (mapeado pelo email) OU admin
create policy "ausencias_update_own_or_admin"
  on public.ausencias for update
  to authenticated
  using (
    public.current_user_is_admin()
    or responsavel_id in (
      select id from public.responsaveis
      where lower(email) = lower(auth.email())
    )
  )
  with check (
    public.current_user_is_admin()
    or responsavel_id in (
      select id from public.responsaveis
      where lower(email) = lower(auth.email())
    )
  );

-- DELETE: o próprio OU admin
create policy "ausencias_delete_own_or_admin"
  on public.ausencias for delete
  to authenticated
  using (
    public.current_user_is_admin()
    or responsavel_id in (
      select id from public.responsaveis
      where lower(email) = lower(auth.email())
    )
  );


-- ─── SANITY CHECK ──────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='ausencias' order by ordinal_position;
--
-- select policyname, cmd from pg_policies
-- where schemaname='public' and tablename='ausencias' order by policyname;
