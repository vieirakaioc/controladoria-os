-- =============================================================================
-- IMOBILIZADO — só a mudança do prazo por gatilho
-- =============================================================================
--
-- POR QUE ESTE ARQUIVO EXISTE:
--   O schema completo faz dezenas de ALTER TABLE e, com o portal aberto em
--   outra aba, o lock exclusivo de um ALTER cruza com a leitura do app e o
--   Postgres mata um dos dois por deadlock. Este recorte tem só o que mudou
--   agora: entra e sai rápido demais para colidir.
--
--   Rodar o schema completo continua valendo e é idempotente — este é apenas o
--   caminho curto quando o outro esbarra em lock.
--
-- O QUE FAZ:
--   • cria a coluna `prazo_a_partir_de` nas duas tabelas de etapa;
--   • ATPV passa a contar 10 dias úteis da conclusão do centro de custo;
--   • placa passa a contar 1 dia útil da conclusão do ATPV.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

-- Falha rápido em vez de ficar preso atrás de outra sessão: melhor um erro
-- claro de "não consegui o lock" do que um deadlock aleatório.
set local lock_timeout = '5s';

alter table public.imobilizado_modelo_etapas
  add column if not exists prazo_a_partir_de text;

alter table public.imobilizado_etapas
  add column if not exists prazo_a_partir_de text;


-- ─── A regra nova ───────────────────────────────────────────────────────────
-- O ATPV era cobrado a partir de quando chegava a vez dele na fila, o que
-- começava a contagem tarde demais e escondia a espera real da frota.
update public.imobilizado_modelo_etapas
   set prazo_a_partir_de = 'cadastro',
       prazo_dias_uteis  = 10
 where chave = 'atpv';

update public.imobilizado_modelo_etapas
   set prazo_a_partir_de = 'atpv',
       prazo_dias_uteis  = 1
 where chave = 'placa';


-- ─── Conferência ────────────────────────────────────────────────────────────
-- Deve mostrar atpv 10 (após cadastro) e placa 1 (após atpv):
--
-- select ordem, chave, titulo, prazo_dias_uteis, prazo_a_partir_de
--   from public.imobilizado_modelo_etapas
--  where prazo_a_partir_de is not null
--  order by ordem;
