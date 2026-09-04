-- =============================================================================
-- IMOBILIZADO — "enviado para aprovação": o relógio para, o processo continua
-- =============================================================================
--
-- O PROBLEMA:
--   A ordem de compra é criada e vai para aprovação de outra pessoa. Enquanto
--   a aprovação não sai, a etapa seguinte (Lançar NF) não tem como andar — e
--   ficava vermelha por uma espera que não é de quem está com ela.
--
-- A SOLUÇÃO — E O QUE ELA NÃO É:
--   Não é uma etapa de aprovação. Uma etapa a mais no fluxo obrigaria o
--   aprovador a entrar no sistema para o processo destravar, e o processo
--   passaria a depender de um clique que hoje não existe.
--
--   É um estado do item: `espera_desde` marca desde quando ele está parado
--   esperando terceiro. Enquanto está marcado, prazo de etapa aberta não conta
--   atraso em lugar nenhum — fila, quadro, matriz e ficha leem o mesmo campo.
--   Quando a aprovação sai, alguém libera e os prazos são empurrados pelos
--   dias úteis que a espera consumiu: ninguém perde prazo por espera de
--   terceiro, e ninguém ganha prazo de graça.
--
--   O aviso vai para quem aprova — o e-mail fica em `aprovador_email`, no
--   modelo da etapa, e não chumbado no código: quem aprova muda, e trocar isso
--   não pode exigir deploy.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

-- ─── 1. Quais etapas oferecem o envio para aprovação ────────────────────────
alter table public.imobilizado_modelo_etapas
  add column if not exists envia_aprovacao boolean not null default false,
  add column if not exists aprovador_email text;

update public.imobilizado_modelo_etapas
   set envia_aprovacao = true,
       aprovador_email = coalesce(aprovador_email, 'marcus.nunes@comber.com.br')
 where chave = 'ordem_compra';


-- ─── 2. O estado de espera, no item ─────────────────────────────────────────
-- No item, e não na etapa: o que trava é o processo inteiro. A OC já está
-- concluída quando a espera começa — quem fica parada é a etapa seguinte, e
-- amanhã pode ser outra.
alter table public.imobilizado_itens
  add column if not exists espera_desde  date,
  add column if not exists espera_motivo text,
  add column if not exists espera_etapa  text;

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- select chave, titulo, envia_aprovacao, aprovador_email
--   from public.imobilizado_modelo_etapas order by ordem;
