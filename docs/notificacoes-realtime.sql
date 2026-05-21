-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Ativar Supabase Realtime na tabela notificacoes
-- =============================================================================
--
-- O QUE FAZ:
--   Adiciona public.notificacoes à publication "supabase_realtime", que é o que
--   o Supabase usa pra propagar eventos via WebSocket pros clientes inscritos.
--
-- DEPOIS DISSO:
--   • O front (Sidebar.tsx) usa supabase.channel().subscribe() em vez de
--     polling de 30s
--   • Notificações novas chegam INSTANTANEAMENTE no badge da sininha
--   • RLS continua valendo — cada usuário só recebe eventos das próprias notifs
--
-- IDEMPOTENTE: o IF NOT EXISTS evita erro se já foi rodado antes.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end$$;


-- SANITY CHECK
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
