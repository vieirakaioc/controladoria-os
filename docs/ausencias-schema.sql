-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Schema: tabela ausencias (modo férias / licença / afastamento)
-- =============================================================================
--
-- USO:
--   1. Supabase Dashboard → SQL Editor → cole e rode (idempotente)
--   2. Admin gerencia em /ferias
--   3. Hook useEquipeData filtra automaticamente tarefas dentro do período
--
-- DETALHES:
--   • data_inicio e data_fim são INCLUSIVOS (a pessoa volta no dia seguinte ao
--     data_fim)
--   • motivo é livre: 'férias', 'licença médica', 'atestado', 'afastamento'
--   • Apaga em cascade se o responsável for removido
-- =============================================================================


-- ─── 1. TABELA ──────────────────────────────────────────────────────────────
-- IMPORTANTE: responsavel_id é bigint pra bater com o tipo de responsaveis.id.
-- Se sua schema usar outro tipo (uuid, integer), ajuste aqui.
create table if not exists public.ausencias (
  id              uuid primary key default gen_random_uuid(),
  responsavel_id  bigint not null references public.responsaveis(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date not null,
  motivo          text default 'férias',
  observacao      text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  constraint ausencias_periodo_valido check (data_inicio <= data_fim)
);

comment on table  public.ausencias                is 'Períodos em que um colaborador está fora (férias/licença). Tarefas e dias dentro do período não contam pro score.';
comment on column public.ausencias.data_inicio    is 'Primeiro dia de ausência (inclusivo).';
comment on column public.ausencias.data_fim       is 'Último dia de ausência (inclusivo). Pessoa volta no dia seguinte.';
comment on column public.ausencias.motivo         is 'Tipo: férias, licença, atestado, afastamento, etc.';


-- ─── 2. ÍNDICES ─────────────────────────────────────────────────────────────
create index if not exists ausencias_resp_periodo_idx
  on public.ausencias (responsavel_id, data_inicio, data_fim);

create index if not exists ausencias_periodo_idx
  on public.ausencias (data_inicio, data_fim);


-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
alter table public.ausencias enable row level security;

-- Apaga policies antigas se existirem (idempotente)
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

-- SELECT: todos autenticados (Monitor precisa ler pra filtrar)
create policy "ausencias_read_all"
  on public.ausencias for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: admin only
-- (Usa current_user_is_admin() criada em user-activity-schema.sql / rls-reset-v2)
create policy "ausencias_write_admin"
  on public.ausencias for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 4. SANITY CHECK ────────────────────────────────────────────────────────
-- select * from public.ausencias order by data_inicio desc;
-- select policyname, cmd from pg_policies where schemaname='public' and tablename='ausencias';
