-- =============================================================================
-- IMOBILIZADO — fechar o buraco na numeração depois de excluir um item
-- =============================================================================
--
-- O PROBLEMA:
--   `numero` vem de uma sequence. Excluído o item 2, a fila mostrava 1 e 3: o
--   número deixava de ser a posição na lista e virava um código com furos.
--
-- A SOLUÇÃO:
--   Uma função que reatribui os números pela ordem atual e reposiciona a
--   sequence. Fica no banco, e não na tela, por dois motivos: é uma transação
--   só (ninguém enxerga a fila meio renumerada) e o índice único de `numero`
--   não perdoa uma atualização feita linha a linha da metade errada.
--
--   Por isso a passagem pelos negativos: primeiro cada item recebe -posição,
--   uma faixa que nenhum item ocupa, e só então volta ao positivo. Sem isso,
--   renumerar 3 → 2 esbarraria no 2 que ainda existe.
--
-- O QUE NÃO MUDA:
--   A pasta no Storage. Ela foi criada com o número de nascimento do item e é
--   onde os documentos estão de fato gravados; renomeá-la deixaria os arquivos
--   antigos num prefixo e os novos em outro. O caminho continua o que aparece
--   na ficha — o número é a posição na fila, a pasta é o endereço do arquivo.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

create or replace function public.imob_renumerar_itens()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  ultimo bigint;
begin
  -- SECURITY DEFINER passa por cima da RLS, então a permissão é conferida
  -- aqui, com a mesma regra que decide quem pode excluir.
  if not public.imob_pode_agir() then
    raise exception 'Sem permissão para renumerar os itens do imobilizado.';
  end if;

  -- Fase 1: cada item vai para -posição, longe de qualquer número em uso.
  with ordem as (
    select id, row_number() over (order by numero) as pos
      from public.imobilizado_itens
  )
  update public.imobilizado_itens i
     set numero = -o.pos
    from ordem o
   where i.id = o.id
     and i.numero <> o.pos;

  -- Fase 2: de volta ao positivo, agora sem buraco e sem colisão.
  update public.imobilizado_itens
     set numero = -numero
   where numero < 0;

  -- A sequence acompanha, senão o próximo cadastro repetiria um número.
  select coalesce(max(numero), 0) into ultimo from public.imobilizado_itens;
  perform setval('public.imobilizado_itens_numero_seq', greatest(ultimo, 1), ultimo > 0);
end;
$fn$;

grant execute on function public.imob_renumerar_itens() to authenticated;

notify pgrst, 'reload schema';

-- Fecha os buracos que já existem hoje:
select public.imob_renumerar_itens();
