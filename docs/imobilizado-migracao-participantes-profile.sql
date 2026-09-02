-- =============================================================================
-- IMOBILIZADO — participante passa a ser vinculado ao login, não ao cadastro
-- =============================================================================
--
-- O PROBLEMA:
--   `imobilizado_participantes` apontava para `responsaveis`, que só é
--   alimentada pela sincronização da planilha na tela Início. Quem tem login
--   no portal mas não está naquela planilha não aparecia na lista, e portanto
--   não podia ser incluído no processo.
--
-- A MUDANÇA:
--   O vínculo passa a ser com `profiles` — a tabela de quem faz login. E o
--   casamento na RLS deixa de ser por e-mail e passa a ser por `auth.uid()`,
--   que é identidade exata: some o risco de grafia que já custou caro aqui
--   (um e-mail sem uma letra deixa a pessoa fora sem nenhum erro na tela).
--
--   `profiles` ganha a coluna `email`, porque os avisos do módulo precisam do
--   endereço e o cliente do navegador não pode ler `auth.users`.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

-- ─── 1. E-mail no perfil ────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists email text;

-- Preenche a partir do login. Aqui no editor SQL há privilégio para ler
-- auth.users; no navegador, não — daí a coluna existir.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

create index if not exists profiles_email_idx on public.profiles (lower(email));


-- ─── 2. Participante aponta para o perfil ───────────────────────────────────
alter table public.imobilizado_participantes
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

-- responsavel_id deixa de ser obrigatório: quem entra pelo login pode nem
-- existir no cadastro da planilha.
alter table public.imobilizado_participantes
  alter column responsavel_id drop not null;

-- Índice único SEM cláusula WHERE: o Postgres não aceita índice parcial na
-- inferência do ON CONFLICT, e é assim que a tela inclui alguém. Nulo não
-- conflita com nulo num índice único, então quem ficou sem profile_id (linha
-- antiga) continua convivendo aqui sem colidir.
drop index if exists public.imob_participantes_profile_idx;

create unique index if not exists imob_participantes_profile_idx
  on public.imobilizado_participantes (profile_id);

-- Traz quem já estava cadastrado: casa o responsável antigo com o perfil de
-- mesmo e-mail. Quem não tiver login fica sem profile_id e continua valendo
-- pelo caminho antigo.
update public.imobilizado_participantes p
   set profile_id = perfil.id
  from public.responsaveis r
  join public.profiles perfil on lower(perfil.email) = lower(r.email)
 where p.responsavel_id = r.id
   and p.profile_id is null;


-- ─── 3. Quem sou eu no módulo ───────────────────────────────────────────────
-- Compara auth.uid() com o perfil. O caminho por e-mail continua como reserva
-- para linhas antigas que ainda não têm profile_id — sem ele, quem já estava
-- no processo perderia o acesso no instante em que este script rodasse.
create or replace function public.imob_meu_tipo()
returns text
language sql
security definer
stable
set search_path = public
as $fn$
  select case
    when public.current_user_is_admin() then 'admin'
    else (
      select p.tipo
        from public.imobilizado_participantes p
       where p.ativo
         and (
           p.profile_id = auth.uid()
           or exists (
             select 1
               from public.responsaveis r
              where r.id = p.responsavel_id
                and lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
           )
         )
       limit 1
    )
  end;
$fn$;
grant execute on function public.imob_meu_tipo() to authenticated;


-- ─── Conferência ────────────────────────────────────────────────────────────
-- Quantos perfis ficaram sem e-mail (deve ser 0):
-- select count(*) from public.profiles where email is null;
--
-- Participantes e o vínculo de cada um:
-- select p.tipo, p.papel, perfil.full_name, perfil.email
--   from public.imobilizado_participantes p
--   left join public.profiles perfil on perfil.id = p.profile_id;
