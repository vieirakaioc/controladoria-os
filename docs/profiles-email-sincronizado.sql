-- =============================================================================
-- PROFILES.EMAIL — parar de depender de a pessoa fazer login
-- =============================================================================
--
-- O PROBLEMA:
--   `profiles.email` é cópia do e-mail que vive em `auth.users`. A cópia
--   existe porque o navegador não lê a tabela de autenticação, e as listas de
--   pessoas do portal precisam do endereço.
--
--   Só que a cópia era preenchida em dois momentos: uma migração que rodou uma
--   vez, e o próprio app quando a pessoa faz login. Quem foi criado depois
--   daquela migração e ainda não entrou no portal ficava sem e-mail — e sem
--   e-mail a pessoa desaparece dos seletores e não recebe aviso nenhum.
--
--   O sintoma é sempre esse: alguém que existe em Gestão de Acessos mas não
--   aparece na lista de responsável ou de participante.
--
-- A SOLUÇÃO:
--   Um gatilho em `auth.users`. O e-mail chega ao perfil no instante em que o
--   usuário é criado, e acompanha a troca de endereço depois — sem depender de
--   ninguém abrir o portal.
--
--   O nome do gatilho começa com "z" de propósito: o Postgres dispara os
--   gatilhos de uma tabela em ordem alfabética, e o perfil é criado pelo
--   `handle_new_user` do Supabase. Vindo depois dele na ordem, a linha do
--   perfil já existe quando este gatilho roda.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '10s';

-- ─── 1. Acerta quem está sem e-mail agora ───────────────────────────────────
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;


-- ─── 2. E daqui para a frente, sozinho ──────────────────────────────────────
create or replace function public.sincronizar_email_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Sem insert: a linha do perfil é criada pelo handle_new_user, e duplicar
  -- essa responsabilidade aqui daria duas verdades sobre quem cria perfil.
  -- Se ela ainda não existir, o update não acha nada e o passo 1 resolve na
  -- próxima vez que este arquivo rodar.
  update public.profiles
     set email = new.email
   where id = new.id
     and email is distinct from new.email;

  return new;
end;
$fn$;

drop trigger if exists z_sincronizar_email_do_perfil on auth.users;
create trigger z_sincronizar_email_do_perfil
  after insert or update of email on auth.users
  for each row execute function public.sincronizar_email_do_perfil();

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Deve voltar vazio:
-- select id, full_name from public.profiles where email is null;
--
-- Perfil sem usuário de autenticação (existe em profiles, nunca teve login —
-- estes continuam sem e-mail, e o caminho é criar o acesso para a pessoa):
-- select p.id, p.full_name
--   from public.profiles p
--   left join auth.users u on u.id = p.id
--  where u.id is null;
--
-- Onde está a Daiane, e o que ela tem hoje:
-- select p.full_name, p.email as email_no_perfil, u.email as email_do_login
--   from public.profiles p
--   left join auth.users u on u.id = p.id
--  where p.full_name ilike '%daiane%';
