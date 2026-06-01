-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- MERGE de matrizes duplicadas (atividades não-Ad Hoc)
-- =============================================================================
--
-- BUG RAIZ:
--   Múltiplas importações de Excel sem Task_ID criaram a mesma rotina várias
--   vezes (cada uma com um UUID novo). Visualmente parece "cartão duplicado"
--   mas no banco são rotinas-mãe distintas.
--
-- ESTRATÉGIA:
--   1) Pra cada grupo de duplicatas (mesmo nome lower, responsável, planner,
--      frequência, dia_da_semana, dia_util), elege a CANÔNICA = task_id menor.
--   2) Reassign todas as tarefas_diarias das outras pra canônica.
--   3) Dedup tarefas_diarias (o reassign cria colisões).
--   4) Apaga as matrizes não-canônicas.
--   5) Recria o constraint UNIQUE.
--
-- EXCLUSÃO: planner_name = 'Ad Hoc' não é tocado — cada Ad Hoc é uma demanda
-- distinta mesmo com mesmo nome.
--
-- BACKUP: rode um snapshot no Supabase antes (Dashboard → Database → Backups).
-- =============================================================================


-- ─── 1. DROP CONSTRAINTS ────────────────────────────────────────────────────
alter table public.tarefas_diarias drop constraint if exists tarefas_diarias_unique;
alter table public.tarefas_diarias drop constraint if exists tarefas_diarias_atv_data_unique;


-- ─── 2. REASSIGN TAREFAS_DIARIAS PRO CANÔNICO ───────────────────────────────
with grupos as (
  select
    task_id,
    row_number() over (
      partition by lower(nome_atividade), responsavel_id, planner_name, frequencia,
                   coalesce(dia_da_semana, ''), coalesce(dia_util, -1)
      order by task_id
    ) as rn,
    first_value(task_id) over (
      partition by lower(nome_atividade), responsavel_id, planner_name, frequencia,
                   coalesce(dia_da_semana, ''), coalesce(dia_util, -1)
      order by task_id
    ) as canonical
  from public.atividades
  where coalesce(planner_name, '') != 'Ad Hoc'
)
update public.tarefas_diarias td
set atividade_id = g.canonical
from grupos g
where td.atividade_id = g.task_id and g.rn > 1;


-- ─── 3. DEDUP TAREFAS_DIARIAS ───────────────────────────────────────────────
-- Mantém a melhor entrada por (atividade canônica, data).
delete from public.tarefas_diarias td
using (
  select id,
         row_number() over (
           partition by atividade_id, data_vencimento
           order by
             case when data_conclusao is null then 1 else 0 end,
             case when observacoes is null then 1 else 0 end,
             case when anexo_url is null then 1 else 0 end,
             id
         ) as rn
  from public.tarefas_diarias
) dups
where td.id = dups.id and dups.rn > 1;


-- ─── 4. APAGA MATRIZES DUPLICADAS ───────────────────────────────────────────
with grupos as (
  select
    task_id,
    row_number() over (
      partition by lower(nome_atividade), responsavel_id, planner_name, frequencia,
                   coalesce(dia_da_semana, ''), coalesce(dia_util, -1)
      order by task_id
    ) as rn
  from public.atividades
  where coalesce(planner_name, '') != 'Ad Hoc'
)
delete from public.atividades a
using grupos g
where a.task_id = g.task_id and g.rn > 1;


-- ─── 5. RECRIA CONSTRAINT UNIQUE ────────────────────────────────────────────
alter table public.tarefas_diarias
  add constraint tarefas_diarias_unique
  unique (atividade_id, data_vencimento);


-- ─── 6. SANITY CHECKS ──────────────────────────────────────────────────────
-- Devem retornar 0 linhas:
--
-- select nome_atividade, responsavel_id, planner_name, frequencia, count(*)
-- from public.atividades
-- where coalesce(planner_name, '') != 'Ad Hoc'
-- group by 1,2,3,4
-- having count(*) > 1;
--
-- select atividade_id, data_vencimento, count(*)
-- from public.tarefas_diarias
-- group by 1,2
-- having count(*) > 1;
