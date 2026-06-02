-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Adiciona status de aprovação Sênior nas ausências
-- =============================================================================
--
-- Permite registrar se uma ausência cadastrada no Portal já foi solicitada
-- e aprovada no sistema oficial de RH (Sênior).
--
-- Valores: Não solicitada / Solicitada / Aprovada / Recusada
--
-- IDEMPOTENTE: pode rodar mais de uma vez.
-- =============================================================================

alter table public.ausencias
  add column if not exists aprovacao_status text default 'Não solicitada';

comment on column public.ausencias.aprovacao_status is
  'Status no sistema da empresa (Sênior). Valores: Não solicitada / Solicitada / Aprovada / Recusada.';

-- Atualiza linhas existentes pra ter um valor default (não null)
update public.ausencias
  set aprovacao_status = 'Não solicitada'
  where aprovacao_status is null;
