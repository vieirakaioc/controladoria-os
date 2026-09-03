-- =============================================================================
-- IMOBILIZADO — chassi do veículo
-- =============================================================================
--
-- Campo só de frota: identifica o veículo antes de existir placa, e é o que
-- denuncia o mesmo veículo cadastrado duas vezes.
--
-- POR QUE NÃO É `unique`:
--   Duplicidade aqui é aviso, não impedimento. Existe caso legítimo — um item
--   cancelado e recadastrado, um chassi digitado errado no item antigo — e um
--   erro do banco no meio do cadastro faria a pessoa perder o formulário
--   inteiro. A tela avisa e mostra qual item já tem aquele chassi; quem
--   cadastra decide.
--
-- O índice é sobre `upper(chassi)` porque a busca é assim: o chassi é gravado
-- em caixa alta, mas quem digita em minúsculas tem que achar do mesmo jeito.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

alter table public.imobilizado_itens
  add column if not exists chassi text;

create index if not exists imobilizado_itens_chassi_idx
  on public.imobilizado_itens (upper(chassi));

notify pgrst, 'reload schema';
