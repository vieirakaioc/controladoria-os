-- =============================================================================
-- IMOBILIZADO — fechar as etapas que abriram fora da vez
-- =============================================================================
--
-- O QUE ACONTECEU:
--   Reabrir uma etapa concluída deixava a seguinte aberta. Ao concluir a
--   reaberta, o sistema procurava a próxima etapa BLOQUEADA — e como a
--   seguinte estava aberta, ela não entrava no filtro: a busca passava por
--   cima dela e abria a etapa de baixo. Ficavam duas correndo ao mesmo tempo,
--   uma delas antes da sua vez.
--
--   Os dois lados já foram corrigidos no app (reabrir volta a seguinte para
--   bloqueada; concluir procura a próxima PENDENTE, não a próxima bloqueada).
--   Este script arruma os itens que passaram pelo problema.
--
-- O QUE ELE FAZ:
--   Em cada item, entre as etapas sequenciais abertas, mantém apenas a de
--   menor ordem — a que é de fato a vez. As demais voltam a bloqueada e
--   perdem o prazo, que será recalculado quando abrirem de verdade.
--
--   Etapa paralela não entra: ela corre por fora justamente para não depender
--   da ordem. Concluída não entra: trabalho feito não se desfaz para arrumar
--   a aparência da fila.
--
-- IDEMPOTENTE: rodar de novo não muda nada.
-- =============================================================================

set local lock_timeout = '5s';

-- Confira antes o que será alterado:
-- select i.numero, e.ordem, e.titulo
--   from public.imobilizado_etapas e
--   join public.imobilizado_itens i on i.id = e.item_id
--  where e.status = 'aberta' and not e.paralela
--    and e.ordem > (select min(e2.ordem)
--                     from public.imobilizado_etapas e2
--                    where e2.item_id = e.item_id
--                      and e2.status = 'aberta' and not e2.paralela)
--  order by i.numero, e.ordem;

update public.imobilizado_etapas e
   set status = 'bloqueada',
       aberta_em = null,
       prazo = null
 where e.status = 'aberta'
   and not e.paralela
   and e.ordem > (
     select min(e2.ordem)
       from public.imobilizado_etapas e2
      where e2.item_id = e.item_id
        and e2.status = 'aberta'
        and not e2.paralela
   );
