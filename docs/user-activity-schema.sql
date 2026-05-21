-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Schema para tracking de atividade do usuário (Monitor do Gerente)
-- =============================================================================
--
-- COMO USAR:
--   1. Supabase Dashboard → SQL Editor
--   2. Cole este arquivo inteiro e rode.
--   3. Idempotente — pode rodar de novo sem dar erro.
--
-- O QUE FAZ:
--   - Cria a tabela `public.user_activity` que registra cada interação relevante
--     (login, page_view, task_completed, task_created, etc).
--   - Cria policies RLS que permitem cada usuário INSERIR/LER seus próprios
--     eventos, e admins LEREM os eventos de todos (sem recursão).
--   - Cria índices para consultas frequentes (por usuário, por data).
--
-- POR QUE NÃO USAR `auth.users.last_sign_in_at`:
--   - Esse campo só registra o último login. Não dá pra saber se a pessoa está
--     ATIVA hoje (acessou nas últimas X horas, fez X ações, etc).
--   - Pra calcular "score de uso" precisamos saber quantos dias úteis a pessoa
--     entrou no app no período avaliado.
--
-- =============================================================================


-- ─── 1. TABELA ──────────────────────────────────────────────────────────────
create table if not exists public.user_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_email  text,
  event_type  text not null,         -- 'session_start' | 'page_view' | 'task_completed' | 'task_created' | 'task_status_changed' | ...
  event_data  jsonb,                 -- payload opcional: { page: '/tarefas', task_id: 'x', etc }
  created_at  timestamptz not null default now()
);

-- Comentários pra documentação
comment on table  public.user_activity                 is 'Trilha de uso do app: usado pelo Monitor do Gerente em /equipe';
comment on column public.user_activity.event_type      is 'Tipo do evento. Use snake_case. Ex: session_start, page_view, task_completed';
comment on column public.user_activity.event_data      is 'JSON livre com contexto: { page, task_id, from_status, to_status, ... }';


-- ─── 2. ÍNDICES ─────────────────────────────────────────────────────────────
-- Consultas mais comuns:
--   - "atividade do usuário X no período Y" → (user_id, created_at desc)
--   - "tipo de evento Z no período Y"      → (event_type, created_at desc)
--   - "todas as atividades no mês"         → (created_at desc)
create index if not exists user_activity_user_created_idx
  on public.user_activity (user_id, created_at desc);

create index if not exists user_activity_event_created_idx
  on public.user_activity (event_type, created_at desc);

create index if not exists user_activity_created_idx
  on public.user_activity (created_at desc);


-- ─── 3. RLS (Row-Level Security) ────────────────────────────────────────────
alter table public.user_activity enable row level security;

-- Apaga qualquer policy antiga (se rodou antes com outro nome)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_activity'
  loop
    execute format('drop policy if exists %I on public.user_activity', pol.policyname);
  end loop;
end$$;

-- INSERT: cada usuário só pode registrar eventos PARA SI MESMO.
-- (Impede um usuário malicioso de registrar acessos falsos pra outra pessoa.)
create policy "user_activity_insert_own"
  on public.user_activity for insert
  to authenticated
  with check (user_id = auth.uid());

-- SELECT: cada usuário lê os próprios eventos.
-- Admins precisam ler de todos → policy separada abaixo (sem subquery recursiva).
create policy "user_activity_select_own"
  on public.user_activity for select
  to authenticated
  using (user_id = auth.uid());

-- SELECT admin: lê tudo.
-- Aqui SIM precisamos checar se o usuário logado é admin lendo de `profiles`.
-- Pra evitar qualquer chance de recursão, usamos uma função SECURITY DEFINER
-- que ignora RLS quando lê profiles.
create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.current_user_is_admin() to authenticated;

create policy "user_activity_select_admin"
  on public.user_activity for select
  to authenticated
  using (public.current_user_is_admin());

-- Sem policy de UPDATE/DELETE → ninguém com 'authenticated' edita ou apaga
-- eventos. Histórico imutável (admin pode limpar via SQL editor se precisar).


-- ─── 4. SANITY CHECK ────────────────────────────────────────────────────────
-- Roda essas queries depois pra confirmar tudo no lugar:
--
-- select count(*) from public.user_activity;
--
-- select * from pg_policies
--  where schemaname = 'public' and tablename = 'user_activity'
--  order by policyname;
--
-- Deve listar 3 policies: insert_own, select_own, select_admin.
