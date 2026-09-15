-- =============================================================================
-- ACESSO POR ESCOPO — controladoria, projeto (Sankhya) ou os dois
-- =============================================================================
--
-- POR QUE:
--   As atividades de implantação do Sankhya passam a ser controladas aqui, com
--   gente que não é da controladoria. Quem é só do projeto não tem o que fazer
--   nas telas de rotina fiscal, e a rotina fiscal não é assunto de quem está
--   implantando sistema.
--
-- O QUE ESTE SCRIPT FAZ:
--   Uma coluna em `profiles`. É o cadastro de quem faz login, e é dele que as
--   telas passam a decidir o que mostrar.
--
--   O padrão é 'controladoria': quem já usa o portal hoje continua exatamente
--   como está. Ninguém perde tela por causa desta migração — o novo escopo é
--   opt-in, marcado a dedo em Gestão de Acessos.
--
-- O QUE NÃO ESTÁ AQUI:
--   Como uma atividade é reconhecida como "do projeto": isso já existe, é
--   `atividades.projeto_id`. Atividade com projeto é atividade de projeto;
--   sem projeto é rotina de controladoria. Nada novo para preencher.
--
--   O papel `admin_projeto` também não aparece aqui: `profiles.role` é texto
--   livre, então o valor novo entra pelo seletor da tela sem migração.
--
-- IDEMPOTENTE: pode rodar de novo sem erro.
-- =============================================================================

set local lock_timeout = '5s';

-- ─── 1. O escopo da pessoa ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists escopo text not null default 'controladoria';

-- A restrição vem depois da coluna e do default: em tabela que já tem linhas,
-- criar as duas juntas faria o check rodar contra nulos que ainda não foram
-- preenchidos.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_escopo_check'
  ) then
    alter table public.profiles
      add constraint profiles_escopo_check
      check (escopo in ('projeto', 'controladoria', 'ambos'));
  end if;
end $$;


-- ─── 2. O escopo de quem está logado ────────────────────────────────────────
-- SECURITY DEFINER porque lê `profiles`, que tem RLS. Serve às políticas que
-- vierem depois e ao diagnóstico: é a mesma resposta que a tela usa, então não
-- há como tela e banco discordarem sobre quem é de onde.
create or replace function public.meu_escopo()
returns text
language sql
security definer
stable
set search_path = public
as $fn$
  select coalesce(
    (select escopo from public.profiles where id = auth.uid()),
    'controladoria'
  );
$fn$;
grant execute on function public.meu_escopo() to authenticated;

/**
 * Vê tudo do projeto: o admin do portal e o admin do projeto.
 *
 * Dois papéis diferentes de propósito — dá para ter um admin da implantação
 * que não é admin da controladoria.
 */
create or replace function public.pode_ver_todo_projeto()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select coalesce(
    (select role in ('admin', 'admin_projeto') from public.profiles where id = auth.uid()),
    false
  );
$fn$;
grant execute on function public.pode_ver_todo_projeto() to authenticated;

notify pgrst, 'reload schema';

-- ─── Conferência ────────────────────────────────────────────────────────────
-- Quem é de onde:
-- select full_name, email, role, escopo from public.profiles order by escopo, full_name;
--
-- Quantas atividades são de projeto (têm projeto_id) e quantas são rotina:
-- select case when projeto_id is null then 'controladoria' else 'projeto' end as tipo,
--        count(*)
--   from public.atividades group by 1;
