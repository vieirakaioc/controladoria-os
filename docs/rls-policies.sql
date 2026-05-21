-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Políticas de RLS (Row Level Security) recomendadas para o Supabase
-- =============================================================================
--
-- COMO USAR:
--   1. Abra o Supabase Dashboard → SQL Editor.
--   2. Cole este arquivo e rode em blocos (cada CREATE POLICY pode falhar se
--      já existir; basta dropar a antiga antes ou usar DROP POLICY IF EXISTS).
--   3. As tabelas referenciadas vêm do código (lib/supabase.ts + páginas).
--      Confira nomes — ajuste se a sua schema usar nomes diferentes.
--
-- PRINCÍPIO:
--   - Hoje a checagem de "admin" acontece no client (supabase.from('profiles')
--     .select('role')). Um usuário malicioso pode burlar isso na devtools.
--   - RLS é o cinto de segurança no banco: mesmo que o front esteja
--     comprometido, o Postgres só devolve o que a policy permitir.
--
-- =============================================================================


-- =============================================================================
-- 1. Helper: função is_admin()
--    Usada em todas as policies para checar role do usuário logado.
--    SECURITY DEFINER porque ela mesma lê profiles (que tem RLS habilitada).
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;


-- =============================================================================
-- 2. profiles
--    - SELECT: qualquer autenticado pode listar (sidebar, /acessos, etc).
--    - UPDATE: o próprio usuário pode editar nome/avatar; só admin pode mudar role.
--    - INSERT: feito pelo trigger handle_new_user() do Supabase Auth.
--    - DELETE: só admin.
-- =============================================================================

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- O próprio usuário atualiza seu perfil — MAS sem poder mexer no role.
-- (A regra que impede mudar o role é o policy WITH CHECK abaixo combinado
-- com a policy admin-only de update do campo role.)
drop policy if exists "profiles_update_own_non_role_fields" on public.profiles;
create policy "profiles_update_own_non_role_fields"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles_update_role_admin_only" on public.profiles;
create policy "profiles_update_role_admin_only"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());


-- =============================================================================
-- 3. Tabelas de referência (somente leitura para membros, admin gerencia)
--    setores, responsaveis, prioridades, frequencias, classificacoes, feriados
-- =============================================================================

do $$
declare
  t text;
  refs text[] := array['setores','responsaveis','prioridades','frequencias','classificacoes','feriados'];
begin
  foreach t in array refs loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%I_select_authenticated" on public.%I', t, t);
    execute format(
      'create policy "%I_select_authenticated" on public.%I for select to authenticated using (true)',
      t, t
    );

    execute format('drop policy if exists "%I_write_admin_only" on public.%I', t, t);
    execute format(
      'create policy "%I_write_admin_only" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t, t
    );
  end loop;
end$$;


-- =============================================================================
-- 4. atividades (rotinas matrizes)
--    - SELECT: qualquer autenticado (alimenta o Kanban, Dashboard).
--    - INSERT/UPDATE/DELETE: admin (sincronização Excel + zona de perigo).
-- =============================================================================

alter table public.atividades enable row level security;

drop policy if exists "atividades_select_authenticated" on public.atividades;
create policy "atividades_select_authenticated"
  on public.atividades for select
  to authenticated
  using (true);

drop policy if exists "atividades_write_admin_only" on public.atividades;
create policy "atividades_write_admin_only"
  on public.atividades for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 5. tarefas_diarias (cartões do Kanban)
--    - SELECT: qualquer autenticado (todos veem o board).
--    - INSERT: qualquer autenticado (criar Ad Hoc) — admin via sincronização.
--    - UPDATE: qualquer autenticado (mover cartão, marcar concluído).
--    - DELETE: admin (limpeza em massa).
--
--    Se quiser endurecer (só responsável pode mover), troque o using/with check
--    do UPDATE pela versão comentada embaixo.
-- =============================================================================

alter table public.tarefas_diarias enable row level security;

drop policy if exists "tarefas_diarias_select_authenticated" on public.tarefas_diarias;
create policy "tarefas_diarias_select_authenticated"
  on public.tarefas_diarias for select
  to authenticated
  using (true);

drop policy if exists "tarefas_diarias_insert_authenticated" on public.tarefas_diarias;
create policy "tarefas_diarias_insert_authenticated"
  on public.tarefas_diarias for insert
  to authenticated
  with check (true);

drop policy if exists "tarefas_diarias_update_authenticated" on public.tarefas_diarias;
create policy "tarefas_diarias_update_authenticated"
  on public.tarefas_diarias for update
  to authenticated
  using (true)
  with check (true);

-- Versão restrita (descomente se quiser que apenas responsável/admin atualize):
-- create policy "tarefas_diarias_update_responsavel_ou_admin"
--   on public.tarefas_diarias for update to authenticated
--   using (
--     public.is_admin()
--     or exists (
--       select 1 from public.atividades a
--       join public.responsaveis r on r.id = a.responsavel_id
--       where a.task_id = tarefas_diarias.atividade_id
--         and r.email = auth.email()
--     )
--   );

drop policy if exists "tarefas_diarias_delete_admin_only" on public.tarefas_diarias;
create policy "tarefas_diarias_delete_admin_only"
  on public.tarefas_diarias for delete
  to authenticated
  using (public.is_admin());


-- =============================================================================
-- 6. tarefa_comentarios
-- =============================================================================

alter table public.tarefa_comentarios enable row level security;

drop policy if exists "tarefa_comentarios_select_authenticated" on public.tarefa_comentarios;
create policy "tarefa_comentarios_select_authenticated"
  on public.tarefa_comentarios for select
  to authenticated
  using (true);

drop policy if exists "tarefa_comentarios_insert_authenticated" on public.tarefa_comentarios;
create policy "tarefa_comentarios_insert_authenticated"
  on public.tarefa_comentarios for insert
  to authenticated
  with check (true);

-- Quem comentou pode editar/apagar; admin pode apagar tudo.
drop policy if exists "tarefa_comentarios_update_own_or_admin" on public.tarefa_comentarios;
create policy "tarefa_comentarios_update_own_or_admin"
  on public.tarefa_comentarios for update
  to authenticated
  using (autor_id = auth.uid() or public.is_admin())
  with check (autor_id = auth.uid() or public.is_admin());

drop policy if exists "tarefa_comentarios_delete_own_or_admin" on public.tarefa_comentarios;
create policy "tarefa_comentarios_delete_own_or_admin"
  on public.tarefa_comentarios for delete
  to authenticated
  using (autor_id = auth.uid() or public.is_admin());


-- =============================================================================
-- 7. notificacoes
--    - Cada usuário só vê e marca-como-lida as PRÓPRIAS notificações.
--    - INSERT deveria ser feito pelo backend (service_role) — não permitir
--      que o client crie notificações arbitrárias.
-- =============================================================================

alter table public.notificacoes enable row level security;

drop policy if exists "notificacoes_select_own" on public.notificacoes;
create policy "notificacoes_select_own"
  on public.notificacoes for select
  to authenticated
  using (user_email = auth.email());

drop policy if exists "notificacoes_update_own" on public.notificacoes;
create policy "notificacoes_update_own"
  on public.notificacoes for update
  to authenticated
  using (user_email = auth.email())
  with check (user_email = auth.email());

-- Sem policy de INSERT/DELETE = ninguém com role 'authenticated' pode fazer.
-- Use service_role (rota /api/notify) ou um trigger no banco para criar.


-- =============================================================================
-- 8. empresa_config (logo, configurações globais)
-- =============================================================================

alter table public.empresa_config enable row level security;

drop policy if exists "empresa_config_select_authenticated" on public.empresa_config;
create policy "empresa_config_select_authenticated"
  on public.empresa_config for select
  to authenticated
  using (true);

drop policy if exists "empresa_config_write_admin_only" on public.empresa_config;
create policy "empresa_config_write_admin_only"
  on public.empresa_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 9. planner_workflows (status customizados por planner)
-- =============================================================================

alter table public.planner_workflows enable row level security;

drop policy if exists "planner_workflows_select_authenticated" on public.planner_workflows;
create policy "planner_workflows_select_authenticated"
  on public.planner_workflows for select
  to authenticated
  using (true);

drop policy if exists "planner_workflows_write_admin_only" on public.planner_workflows;
create policy "planner_workflows_write_admin_only"
  on public.planner_workflows for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Se houver tabela planner_status (lista de status por workflow), aplicar o
-- mesmo padrão:
-- alter table public.planner_status enable row level security;
-- create policy "planner_status_select_authenticated" on public.planner_status
--   for select to authenticated using (true);
-- create policy "planner_status_write_admin_only" on public.planner_status
--   for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- =============================================================================
-- 10. auditoria (logs)
--     - Só admin lê.
--     - INSERT deve vir de trigger no banco (não do client).
-- =============================================================================

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_admin_only" on public.auditoria;
create policy "auditoria_select_admin_only"
  on public.auditoria for select
  to authenticated
  using (public.is_admin());

-- Sem policy de INSERT/UPDATE/DELETE = ninguém com 'authenticated' escreve.
-- A trilha de auditoria deve ser populada via TRIGGER em DELETE/UPDATE das
-- tabelas críticas (atividades, tarefas_diarias, profiles), usando
-- SECURITY DEFINER pra contornar a RLS no INSERT do log.


-- =============================================================================
-- 11. projetos
-- =============================================================================

alter table public.projetos enable row level security;

drop policy if exists "projetos_select_authenticated" on public.projetos;
create policy "projetos_select_authenticated"
  on public.projetos for select
  to authenticated
  using (true);

drop policy if exists "projetos_write_admin_only" on public.projetos;
create policy "projetos_write_admin_only"
  on public.projetos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 12. SANITY CHECK
--     Rode esta query depois pra confirmar que TODA tabela tem RLS habilitada.
-- =============================================================================

-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
-- order by tablename;
--
-- Se alguma tabela aparecer com rowsecurity = false, está exposta.
