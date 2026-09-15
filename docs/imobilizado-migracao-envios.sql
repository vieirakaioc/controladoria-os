-- =============================================================================
-- IMOBILIZADO — trava do resumo diário
-- =============================================================================
--
-- O resumo da manhã vai para a equipe inteira do processo, e o disparo
-- acontece no navegador de quem abre o app (mesma filosofia do resumo da
-- validação fiscal — não há cron no servidor).
--
-- Por isso a trava não pode ser local: com `localStorage`, cada pessoa que
-- abrisse o portal mandaria o seu próprio resumo para a lista toda. É uma
-- linha por dia aqui, e a chave primária na data garante que só o primeiro
-- navegador do dia envia.
--
-- Delete liberado de propósito: quem reservou o dia e não conseguiu enviar
-- (SMTP fora, por exemplo) devolve a linha para a próxima pessoa tentar.
-- Sem isso, uma falha às 6h deixaria a equipe sem resumo até amanhã.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

create table if not exists public.imobilizado_envios (
  data          date        primary key,
  enviado_em    timestamptz not null default now(),
  enviado_por   text,
  destinatarios text
);

alter table public.imobilizado_envios enable row level security;

drop policy if exists "imob_envios_select" on public.imobilizado_envios;
create policy "imob_envios_select"
  on public.imobilizado_envios for select
  to authenticated
  using (true);

drop policy if exists "imob_envios_insert" on public.imobilizado_envios;
create policy "imob_envios_insert"
  on public.imobilizado_envios for insert
  to authenticated
  with check (true);

drop policy if exists "imob_envios_delete" on public.imobilizado_envios;
create policy "imob_envios_delete"
  on public.imobilizado_envios for delete
  to authenticated
  using (true);

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Quem recebeu o resumo em cada dia:
-- select * from public.imobilizado_envios order by data desc limit 10;
--
-- Para reenviar o resumo de hoje (apaga a reserva; a próxima abertura do
-- portal manda de novo):
-- delete from public.imobilizado_envios where data = current_date;
