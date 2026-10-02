-- =============================================================================
-- DESEMPENHO — índices das consultas que toda tela faz
-- =============================================================================
--
-- O SINTOMA:
--   O portal fica mais lento conforme entra gente e passa o tempo, em todas as
--   telas, inclusive ao trocar de tela.
--
-- A CAUSA:
--   Fora `user_activity`, nenhuma tabela quente tinha índice para o filtro que
--   o app realmente usa. `tarefas_diarias` ganha ~1.600 linhas por mês; a
--   consulta do mês filtra por `data_vencimento`, e sem índice o banco lê a
--   tabela inteira — para cada pessoa, em cada carregamento, em cada tela.
--   O custo cresce junto com o histórico, que é exatamente o que se observa.
--
--   O índice único de (atividade_id, data_vencimento) que já existe não serve
--   para isso: ele só é útil quando a consulta parte da atividade. Filtro por
--   data sozinho precisa da data na primeira posição.
--
-- O QUE ESTE SCRIPT FAZ:
--   Cria os índices que faltam. Não muda dado nenhum, não altera regra de
--   acesso e pode rodar com o portal aberto — cada CREATE INDEX segura a
--   tabela por segundos, no tamanho em que elas estão.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '15s';

-- ─── Tarefas do mês ─────────────────────────────────────────────────────────
-- A consulta de toda tela de tarefas e do dashboard: faixa de datas.
create index if not exists tarefas_diarias_vencimento_idx
  on public.tarefas_diarias (data_vencimento);

-- Painéis que contam por situação dentro do mês.
create index if not exists tarefas_diarias_status_vencimento_idx
  on public.tarefas_diarias (status, data_vencimento);


-- ─── Atividades ─────────────────────────────────────────────────────────────
-- Filtros de responsável, planner e projeto aparecem em tarefas, equipe,
-- dashboard e na própria sincronização.
create index if not exists atividades_responsavel_idx
  on public.atividades (responsavel_id);

create index if not exists atividades_planner_idx
  on public.atividades (planner_name);

create index if not exists atividades_projeto_idx
  on public.atividades (projeto_id);


-- ─── Notificações e comentários ─────────────────────────────────────────────
-- O sino do menu lateral busca por e-mail e ordena por data, em toda troca de
-- tela — é a consulta mais repetida do portal inteiro.
create index if not exists notificacoes_usuario_data_idx
  on public.notificacoes (user_email, created_at desc);

create index if not exists tarefa_comentarios_tarefa_idx
  on public.tarefa_comentarios (tarefa_id);


-- ─── Validação fiscal ───────────────────────────────────────────────────────
create index if not exists vf_tarefas_prazo_idx
  on public.validacao_fiscal_tarefas (prazo);

create index if not exists vf_tarefas_status_idx
  on public.validacao_fiscal_tarefas (status);

create index if not exists vf_tarefas_lote_idx
  on public.validacao_fiscal_tarefas (lote_id);


-- ─── Imobilizado ────────────────────────────────────────────────────────────
-- A fila lê todas as etapas de uma vez, por item.
create index if not exists imobilizado_etapas_item_idx
  on public.imobilizado_etapas (item_id);

create index if not exists imobilizado_anexos_item_idx
  on public.imobilizado_anexos (item_id);

create index if not exists imobilizado_movimentos_item_idx
  on public.imobilizado_movimentos (item_id);


-- ─── Estatísticas atualizadas ───────────────────────────────────────────────
-- Sem isto o planejador pode continuar escolhendo o plano antigo por um tempo.
analyze public.tarefas_diarias;
analyze public.atividades;
analyze public.notificacoes;

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Deve aparecer "Index Scan" (e não "Seq Scan") na consulta do mês:
-- explain analyze
-- select id from public.tarefas_diarias
--  where data_vencimento >= '2026-10-01' and data_vencimento < '2026-11-01';
--
-- Tamanho das tabelas quentes, para dimensionar:
-- select relname, n_live_tup from pg_stat_user_tables
--  where relname in ('tarefas_diarias','atividades','notificacoes','user_activity')
--  order by n_live_tup desc;
