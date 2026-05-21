-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Schema: tabela score_config (configuração dos pesos do score do Monitor)
-- =============================================================================
--
-- USO:
--   1. Supabase Dashboard → SQL Editor → cole e rode (idempotente).
--   2. Insere uma linha com defaults se ainda não houver.
--   3. RLS: TODOS os autenticados lêem (front precisa pra calcular o score),
--           apenas ADMIN atualiza.
--
-- =============================================================================


-- ─── 1. TABELA ──────────────────────────────────────────────────────────────
create table if not exists public.score_config (
  id              smallint primary key default 1,
  peso_conclusao  smallint not null default 90,
  peso_uso        smallint not null default 10,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  constraint score_config_singleton    check (id = 1),
  constraint score_config_sum_100      check (peso_conclusao + peso_uso = 100),
  constraint score_config_non_negative check (peso_conclusao >= 0 and peso_uso >= 0)
);

comment on table  public.score_config                is 'Configuração singleton dos pesos do score de desempenho. Sempre id=1.';
comment on column public.score_config.peso_conclusao is '% de peso da dimensão "conclusão" (concluídas/atribuídas). Soma com peso_uso = 100.';
comment on column public.score_config.peso_uso      is '% de peso da dimensão "uso do app" (dias úteis ativos). Soma com peso_conclusao = 100.';

-- Insere o registro padrão se ainda não existir
insert into public.score_config (id, peso_conclusao, peso_uso)
values (1, 90, 10)
on conflict (id) do nothing;


-- ─── 2. RLS ─────────────────────────────────────────────────────────────────
alter table public.score_config enable row level security;

-- Apaga policies antigas (idempotente)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'score_config'
  loop
    execute format('drop policy if exists %I on public.score_config', pol.policyname);
  end loop;
end$$;

-- SELECT: qualquer autenticado (front precisa ler pra calcular o score)
create policy "score_config_select_all"
  on public.score_config for select
  to authenticated
  using (true);

-- UPDATE: só admin (usa a função SECURITY DEFINER que criamos no schema do user_activity)
create policy "score_config_update_admin"
  on public.score_config for update
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Sem policy de INSERT/DELETE = singleton imutável após o seed acima.


-- ─── 3. SANITY CHECK ────────────────────────────────────────────────────────
-- select * from public.score_config;
-- select policyname from pg_policies where schemaname = 'public' and tablename = 'score_config';
