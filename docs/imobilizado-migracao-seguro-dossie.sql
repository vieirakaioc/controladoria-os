-- =============================================================================
-- IMOBILIZADO — corrige o conteúdo das etapas 5 e 6
-- =============================================================================
--
-- O QUE MUDA, E POR QUÊ:
--
--   5 · Seguro  — é NEGOCIAÇÃO, feita por Compras. Deixa de exigir anexo:
--       cobrar arquivo de quem está negociando trava a etapa por um papel que
--       ainda não existe.
--
--   6 · Pasta dossiê — é da FROTA, e o conteúdo dela é inserir os documentos
--       do seguro na pasta. Passa a exigir anexo: sem isso a etapa seria um
--       "ok" sobre documento nenhum.
--
-- O anexo obrigatório mudou de lugar de propósito — saiu de quem negocia e
-- foi para quem guarda.
--
-- Recorte pequeno para não esbarrar em lock com o portal aberto; o schema
-- completo já contém as mesmas linhas.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

update public.imobilizado_modelo_etapas
   set area        = 'Compras',
       descricao   = 'Negocia a apólice do bem com a corretora e registra o resultado na observação.',
       exige_anexo = false
 where chave = 'seguro';

update public.imobilizado_modelo_etapas
   set area        = 'Frota',
       descricao   = 'Insere na pasta do item a apólice e os demais documentos do seguro.',
       exige_anexo = true
 where chave = 'dossie';


-- ─── Itens que já estão correndo ────────────────────────────────────────────
-- Cada item guarda uma cópia das regras de quando nasceu. Estas linhas trazem
-- a correção para as etapas AINDA NÃO CONCLUÍDAS — etapa concluída fica como
-- está, porque é registro do que aconteceu, não do que deveria acontecer.
update public.imobilizado_etapas e
   set area        = m.area,
       exige_anexo = m.exige_anexo
  from public.imobilizado_modelo_etapas m
 where m.chave = e.chave
   and e.chave in ('seguro', 'dossie')
   and e.status <> 'concluida';


-- ─── Conferência ────────────────────────────────────────────────────────────
-- select ordem, chave, titulo, area, exige_anexo
--   from public.imobilizado_modelo_etapas
--  where chave in ('seguro', 'dossie');
