-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- DEDUP de tarefas_diarias + criação de constraint UNIQUE
-- =============================================================================
--
-- BUG RAIZ:
--   A função gerarCicloDoMes no app/page.tsx usa:
--     supabase.from('tarefas_diarias').upsert(..., { onConflict: 'atividade_id,data_vencimento' })
--   Mas isso só funciona se a tabela tiver UNIQUE constraint nesses 2 campos.
--   Sem o constraint, o upsert vira INSERT — cada sincronização cria duplicatas.
--
-- ESTE SCRIPT:
--   1. Remove duplicatas existentes (mantém a versão "melhor" de cada par)
--   2. Cria o constraint UNIQUE pra impedir novas duplicatas
--   3. Confere que ficou limpo
--
-- IDEMPOTENTE: pode rodar de novo sem dar erro (o ADD CONSTRAINT vai falhar
-- na 2ª vez, mas isso é OK — significa que já está protegido).
-- =============================================================================


-- ─── 1. DEDUP ──────────────────────────────────────────────────────────────
-- Mantém a entrada com mais dados preenchidos. Critério de desempate:
--   1º quem tem data_conclusao (tarefa fechada vence vazia)
--   2º quem tem observacoes
--   3º quem tem anexo_url
--   4º id menor (mais antigo)
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


-- ─── 2. CONSTRAINT ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tarefas_diarias_atv_data_unique'
  ) then
    alter table public.tarefas_diarias
      add constraint tarefas_diarias_atv_data_unique
      unique (atividade_id, data_vencimento);
  end if;
end$$;


-- ─── 3. SANITY CHECK ───────────────────────────────────────────────────────
-- Esperado: 0 linhas
-- select atividade_id, data_vencimento, count(*)
-- from public.tarefas_diarias
-- group by 1, 2
-- having count(*) > 1;
