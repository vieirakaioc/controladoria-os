-- =============================================================================
-- MATRIZ DE EISENHOWER — a prioridade que cada pessoa dá às próprias tarefas
-- =============================================================================
--
-- O QUE É:
--   Quatro quadrantes, cruzando urgente com importante. A pessoa arrasta as
--   tarefas dela para o quadrante que achar certo, e passa a enxergar o que
--   fazer agora, o que agendar, o que delegar e o que pode esperar.
--
-- INDIVIDUAL, DE VERDADE:
--   A linha é por (pessoa, tarefa), e a RLS só deixa cada um ver e mexer no
--   que é seu. A mesma atividade pode ser "fazer agora" para uma pessoa e
--   "agendar" para outra, sem que uma veja o julgamento da outra — é isso que
--   faz as pessoas usarem a matriz com honestidade.
--
-- POR QUE A CHAVE É `task_id`, E NÃO A TAREFA DO DIA:
--   `task_id` identifica a ATIVIDADE; `tarefas_diarias` são as ocorrências
--   dela. Classificar a ocorrência obrigaria a reclassificar tudo todo mês,
--   e no mês seguinte a matriz amanheceria vazia. Classificando a atividade,
--   a decisão vale para as próximas vezes — que é como a cabeça da pessoa já
--   funciona ("esse relatório é sempre importante e nunca urgente").
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '10s';

create table if not exists public.prioridades_eisenhower (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  -- atividades.task_id. Texto porque é assim que a planilha o traz.
  task_id    text        not null,
  quadrante  text        not null
               check (quadrante in ('fazer', 'agendar', 'delegar', 'eliminar')),
  criado_em  timestamptz not null default now(),
  primary key (user_id, task_id)
);

create index if not exists prioridades_eisenhower_user_idx
  on public.prioridades_eisenhower (user_id);

alter table public.prioridades_eisenhower enable row level security;

-- Uma política por operação, todas presas a auth.uid(): ninguém lê nem escreve
-- a prioridade de outra pessoa, nem por engano de consulta na tela.
drop policy if exists "eisenhower_select_own" on public.prioridades_eisenhower;
create policy "eisenhower_select_own"
  on public.prioridades_eisenhower for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "eisenhower_insert_own" on public.prioridades_eisenhower;
create policy "eisenhower_insert_own"
  on public.prioridades_eisenhower for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eisenhower_update_own" on public.prioridades_eisenhower;
create policy "eisenhower_update_own"
  on public.prioridades_eisenhower for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eisenhower_delete_own" on public.prioridades_eisenhower;
create policy "eisenhower_delete_own"
  on public.prioridades_eisenhower for delete
  to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Quantas tarefas cada pessoa classificou, por quadrante:
-- select p.full_name, e.quadrante, count(*)
--   from public.prioridades_eisenhower e
--   join public.profiles p on p.id = e.user_id
--  group by 1, 2 order by 1, 2;
