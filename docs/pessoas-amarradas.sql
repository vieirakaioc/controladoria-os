-- =============================================================================
-- PESSOAS — um cadastro só, amarrado ao login
-- =============================================================================
--
-- O PROBLEMA:
--   O portal tem duas tabelas de pessoa, e cada lista lia uma:
--
--     • `profiles`      — quem faz login. Criada pelo Supabase Auth.
--     • `responsaveis`  — o cadastro da planilha, sincronizado na tela Início.
--                         É para ela que apontam as tarefas (atividades), a
--                         validação fiscal, o monitor da equipe e as férias.
--
--   Usuário criado no portal ia para `profiles` e nunca chegava a
--   `responsaveis` — então aparecia em umas listas e sumia de outras, até
--   alguém lembrar de pôr o nome dele na planilha e sincronizar.
--
-- A SOLUÇÃO:
--   Todo login com e-mail passa a existir também em `responsaveis`, na hora,
--   por gatilho. Com isso `responsaveis` sempre contém todo mundo que tem
--   login, mais quem só está na planilha — e toda lista, leia ela uma tabela
--   ou a outra, enxerga as mesmas pessoas.
--
--   Por que não o contrário (todas as telas lendo `profiles`): tarefas e
--   validação fiscal gravam o responsável como chave estrangeira para
--   `responsaveis`. Trocar a fonte dessas telas exigiria migrar essas colunas
--   e todo o histórico. Amarrar no banco resolve sem tocar em dado nenhum.
--
-- O QUE O GATILHO NÃO FAZ:
--   • Não sobrescreve nome que veio da planilha — se o e-mail já existe, fica
--     como está. A planilha é a fonte do nome oficial.
--   • Não apaga ninguém. O sync da planilha também só insere e atualiza, então
--     quem entrou por aqui não some na próxima sincronização.
--   • A comparação de e-mail ignora maiúsculas: "Fulano@Comber" e
--     "fulano@comber" são a mesma pessoa, e não viram duas linhas.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '10s';

-- ─── 1. A regra ─────────────────────────────────────────────────────────────
create or replace function public.garantir_responsavel_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  email_limpo text := lower(trim(coalesce(new.email, '')));
begin
  if email_limpo = '' then
    return new;
  end if;

  if not exists (
    select 1 from public.responsaveis r where lower(trim(r.email)) = email_limpo
  ) then
    insert into public.responsaveis (nome, email)
    values (
      coalesce(nullif(trim(new.full_name), ''), split_part(email_limpo, '@', 1)),
      email_limpo
    );
  end if;

  return new;
end;
$fn$;

drop trigger if exists garantir_responsavel_do_perfil on public.profiles;
create trigger garantir_responsavel_do_perfil
  after insert or update of email, full_name on public.profiles
  for each row execute function public.garantir_responsavel_do_perfil();


-- ─── 2. Quem já tem login e ainda não está no cadastro ──────────────────────
insert into public.responsaveis (nome, email)
select distinct on (lower(trim(p.email)))
       coalesce(nullif(trim(p.full_name), ''), split_part(lower(trim(p.email)), '@', 1)),
       lower(trim(p.email))
  from public.profiles p
 where coalesce(trim(p.email), '') <> ''
   and not exists (
     select 1 from public.responsaveis r
      where lower(trim(r.email)) = lower(trim(p.email))
   );

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Deve voltar vazio — login sem cadastro de pessoa:
-- select p.full_name, p.email
--   from public.profiles p
--  where coalesce(p.email, '') <> ''
--    and not exists (select 1 from public.responsaveis r
--                     where lower(trim(r.email)) = lower(trim(p.email)));
--
-- Login sem e-mail no perfil (não entra em lista nenhuma até ter e-mail —
-- rode o docs/profiles-email-sincronizado.sql se aparecer alguém aqui):
-- select id, full_name from public.profiles where coalesce(email, '') = '';
--
-- Mesma pessoa duas vezes no cadastro por diferença de maiúsculas:
-- select lower(trim(email)), count(*) from public.responsaveis
--  group by 1 having count(*) > 1;
