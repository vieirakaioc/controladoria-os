-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- VALIDAÇÃO FISCAL — tabelas, índices e RLS
-- =============================================================================
--
-- O QUE É:
--   O time de controladoria exporta dois relatórios do Sênior:
--     • relatorio_cte_divergencias  (XML x Sênior: ICMS / ISS Retido)
--     • SITUAÇÕES_LOGISTICA         (2 abas: Situações_Divergentes e
--                                    Autorizado_Cancelado)
--   Cada linha vira uma tarefa de correção fiscal com prazo de resposta de
--   3 dias úteis. A matriz em /validacao-fiscal mostra a linha da planilha
--   fielmente e o responsável dá o "ok" com uma observação.
--
-- POR QUE TABELAS PRÓPRIAS (e não `atividades` / `tarefas_diarias`):
--   Uma importação gera dezenas de itens e eles precisam carregar as colunas
--   originais da planilha. Jogar isso no Painel de Execução afogaria as rotinas
--   do mês e perderia o formato de matriz.
--
-- IDEMPOTENTE: pode rodar de novo sem dar erro.
-- =============================================================================


-- ─── 1. LOTES DE IMPORTAÇÃO ─────────────────────────────────────────────────
create table if not exists public.validacao_fiscal_lotes (
  id            uuid primary key default gen_random_uuid(),
  origem        text        not null,
  arquivo       text        not null,
  importado_por text,
  importado_em  timestamptz not null default now(),
  total_linhas  integer     not null default 0,
  novas         integer     not null default 0,
  duplicadas    integer     not null default 0,
  prazo         date        not null
);


-- ─── 2. TAREFAS DE CORREÇÃO ─────────────────────────────────────────────────
create table if not exists public.validacao_fiscal_tarefas (
  id                  uuid primary key default gen_random_uuid(),
  lote_id             uuid        references public.validacao_fiscal_lotes (id) on delete set null,
  origem              text        not null,
  aba                 text        not null default '',
  -- Chave natural da linha. É o que impede a reimportação semanal do mesmo
  -- relatório de duplicar tarefa ou apagar correção já respondida pelo time.
  chave               text        not null unique,
  documento           text        not null default '',
  tipo_divergencia    text        not null default '',
  emitente            text        not null default '',
  filial              text        not null default '',
  valor               numeric(18, 2),
  emissao             date,
  -- Linha original completa, para a matriz exibir a planilha fielmente.
  dados               jsonb       not null default '{}'::jsonb,
  -- concluida = corrigida; sem_correcao = conferida e já estava certa. Os dois
  -- encerram a tarefa, e separá-los mostra quanto do relatório era divergência
  -- de verdade.
  status              text        not null default 'pendente'
                        check (status in ('pendente', 'em_andamento', 'concluida', 'sem_correcao')),
  -- Por que está parada: com quem está, o que falta.
  motivo_andamento    text,
  -- bigint, não uuid: é o tipo de responsaveis.id neste banco.
  responsavel_id      bigint      references public.responsaveis (id) on delete set null,
  responsavel_nome    text,
  observacao_correcao text,
  prazo               date        not null,
  concluido_em        timestamptz,
  concluido_por       text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- ─── 2.1 Ajustes em banco já criado ─────────────────────────────────────────
-- "create table if not exists" não altera tabela existente, então quem rodou a
-- versão anterior deste arquivo precisa destes dois passos. Ambos são
-- idempotentes: rodar em banco novo não faz nada.

alter table public.validacao_fiscal_tarefas
  add column if not exists motivo_andamento text;

alter table public.validacao_fiscal_tarefas
  drop constraint if exists validacao_fiscal_tarefas_status_check;

alter table public.validacao_fiscal_tarefas
  add constraint validacao_fiscal_tarefas_status_check
  check (status in ('pendente', 'em_andamento', 'concluida', 'sem_correcao'));


create index if not exists vf_tarefas_status_idx      on public.validacao_fiscal_tarefas (status);
create index if not exists vf_tarefas_prazo_idx       on public.validacao_fiscal_tarefas (prazo);
create index if not exists vf_tarefas_origem_idx      on public.validacao_fiscal_tarefas (origem, aba);
create index if not exists vf_tarefas_responsavel_idx on public.validacao_fiscal_tarefas (responsavel_id);
create index if not exists vf_tarefas_lote_idx        on public.validacao_fiscal_tarefas (lote_id);


-- ─── 3. atualizado_em automático ────────────────────────────────────────────
create or replace function public.vf_touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists vf_tarefas_touch on public.validacao_fiscal_tarefas;
create trigger vf_tarefas_touch
  before update on public.validacao_fiscal_tarefas
  for each row execute function public.vf_touch_atualizado_em();


-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Depende de public.current_user_is_admin() (criada em rls-reset-v2.sql).
--
-- Regra: o módulo é restrito. Só admin e as pessoas listadas abaixo enxergam
-- e respondem as correções fiscais — o resto da equipe não vê nada, nem que
-- as tabelas existem. Importar planilha e apagar lote seguem só para admin.

alter table public.validacao_fiscal_lotes   enable row level security;
alter table public.validacao_fiscal_tarefas enable row level security;

-- ─── Quem tem acesso ao módulo ──────────────────────────────────────────────
-- Para liberar mais alguém, acrescente o e-mail na lista do `in (...)` e rode
-- este arquivo de novo. A comparação é pelo e-mail do login (JWT), não pelo
-- cadastro de responsáveis: uma tarefa pode estar atribuída a quem nem usa o
-- sistema, e isso não pode virar permissão de leitura.
create or replace function public.vf_pode_ver()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_is_admin()
      or lower(coalesce(auth.jwt() ->> 'email', '')) in (
           'fernando.carvalho@comber.com.br'
         );
$$;
grant execute on function public.vf_pode_ver() to authenticated;

-- Lotes: leitura restrita, escrita só admin.
drop policy if exists "vf_lotes_select" on public.validacao_fiscal_lotes;
create policy "vf_lotes_select"
  on public.validacao_fiscal_lotes for select
  to authenticated
  using (public.vf_pode_ver());

drop policy if exists "vf_lotes_write_admin" on public.validacao_fiscal_lotes;
create policy "vf_lotes_write_admin"
  on public.validacao_fiscal_lotes for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Tarefas: leitura restrita a admin e à lista do módulo.
drop policy if exists "vf_tarefas_select" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_select"
  on public.validacao_fiscal_tarefas for select
  to authenticated
  using (public.vf_pode_ver());

-- Criação (importação): só admin.
drop policy if exists "vf_tarefas_insert_admin" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_insert_admin"
  on public.validacao_fiscal_tarefas for insert
  to authenticated
  with check (public.current_user_is_admin());

-- Resposta: quem enxerga o módulo. As colunas que descrevem a divergência não
-- são editáveis pela tela; o que muda é status, responsável e observação.
drop policy if exists "vf_tarefas_update" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_update"
  on public.validacao_fiscal_tarefas for update
  to authenticated
  using (public.vf_pode_ver())
  with check (public.vf_pode_ver());

drop policy if exists "vf_tarefas_delete_admin" on public.validacao_fiscal_tarefas;
create policy "vf_tarefas_delete_admin"
  on public.validacao_fiscal_tarefas for delete
  to authenticated
  using (public.current_user_is_admin());


-- ─── 5. Sanity check ────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies
--  where schemaname = 'public'
--    and tablename in ('validacao_fiscal_lotes', 'validacao_fiscal_tarefas')
--  order by tablename, policyname;
