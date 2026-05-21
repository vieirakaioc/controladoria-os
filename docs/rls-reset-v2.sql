-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- RLS RESET v2 — versão segura, sem recursão
-- =============================================================================
--
-- POR QUE EXISTE:
--   O docs/rls-policies.sql original tinha um padrão recursivo no WITH CHECK
--   da policy "profiles_update_own_non_role_fields" que causava 500 silencioso
--   em diversas tabelas. Esse script desfaz aquele estado e aplica policies
--   simples + auditáveis.
--
-- COMO USAR:
--   1. Supabase Dashboard → SQL Editor
--   2. Cole TUDO e rode em um único execute (cada bloco é idempotente)
--   3. Roda também o docs/user-activity-schema.sql se ainda não rodou — esse
--      arquivo depende da função current_user_is_admin() criada lá.
--
-- PRINCÍPIOS:
--   • SELECT pra autenticados quase sempre (front precisa ler)
--   • Mutações sensíveis (DELETE em massa, gestão de roles) restritas a admin
--   • current_user_is_admin() é SECURITY DEFINER → ignora RLS quando lê profiles
--   • Sem subqueries auto-referenciais em WITH CHECK
--
-- =============================================================================


-- ─── 0. PRÉ-REQUISITO: função is_admin (defensiva, recria se faltou) ────────
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


-- ─── Helper de drop massa: limpa TODAS as policies de uma tabela ────────────
create or replace function public._drop_all_policies(tbl text)
returns void
language plpgsql
as $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = tbl
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
  end loop;
end$$;


-- ─── 1. TABELAS DE REFERÊNCIA (read-all, write-admin) ──────────────────────
--      setores, responsaveis, prioridades, frequencias, classificacoes, feriados
do $$
declare t text;
declare refs text[] := array['setores','responsaveis','prioridades','frequencias','classificacoes','feriados'];
begin
  foreach t in array refs loop
    -- só roda se a tabela existir
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('alter table public.%I enable row level security', t);
      perform public._drop_all_policies(t);

      execute format(
        'create policy "%I_read_all" on public.%I for select to authenticated using (true)',
        t, t
      );
      execute format(
        'create policy "%I_write_admin" on public.%I for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin())',
        t, t
      );
    end if;
  end loop;
end$$;


-- ─── 2. ATIVIDADES (rotinas matrizes) ──────────────────────────────────────
alter table public.atividades enable row level security;
select public._drop_all_policies('atividades');

create policy "atividades_read_all"
  on public.atividades for select
  to authenticated
  using (true);

create policy "atividades_write_admin"
  on public.atividades for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 3. TAREFAS_DIARIAS (cartões do Kanban) ────────────────────────────────
alter table public.tarefas_diarias enable row level security;
select public._drop_all_policies('tarefas_diarias');

create policy "tarefas_diarias_read_all"
  on public.tarefas_diarias for select
  to authenticated
  using (true);

-- Qualquer autenticado pode criar (necessário pra Ad Hoc e pra sincronização rodada pelo admin)
create policy "tarefas_diarias_insert_all"
  on public.tarefas_diarias for insert
  to authenticated
  with check (true);

-- Qualquer autenticado pode atualizar (mover Kanban, marcar concluído, editar drawer)
create policy "tarefas_diarias_update_all"
  on public.tarefas_diarias for update
  to authenticated
  using (true)
  with check (true);

-- DELETE só admin (membro usa "excluirTarefa" — se quiser permitir, troca aqui)
create policy "tarefas_diarias_delete_admin"
  on public.tarefas_diarias for delete
  to authenticated
  using (public.current_user_is_admin());


-- ─── 4. TAREFA_COMENTARIOS ─────────────────────────────────────────────────
alter table public.tarefa_comentarios enable row level security;
select public._drop_all_policies('tarefa_comentarios');

create policy "tarefa_comentarios_read_all"
  on public.tarefa_comentarios for select
  to authenticated
  using (true);

create policy "tarefa_comentarios_insert_authenticated"
  on public.tarefa_comentarios for insert
  to authenticated
  with check (true);

-- Editar / apagar: só o autor ou admin
create policy "tarefa_comentarios_update_own_or_admin"
  on public.tarefa_comentarios for update
  to authenticated
  using (autor_id = auth.uid() or public.current_user_is_admin())
  with check (autor_id = auth.uid() or public.current_user_is_admin());

create policy "tarefa_comentarios_delete_own_or_admin"
  on public.tarefa_comentarios for delete
  to authenticated
  using (autor_id = auth.uid() or public.current_user_is_admin());


-- ─── 5. NOTIFICACOES ───────────────────────────────────────────────────────
--      O app cria notificações client-side (CommentsThread, AdHoc, etc.) então
--      INSERT precisa ser liberado pra qualquer autenticado.
alter table public.notificacoes enable row level security;
select public._drop_all_policies('notificacoes');

-- Cada usuário só vê as próprias
create policy "notificacoes_read_own"
  on public.notificacoes for select
  to authenticated
  using (user_email = auth.email() or public.current_user_is_admin());

-- Qualquer autenticado pode criar notificações pros outros (mention, ad hoc)
create policy "notificacoes_insert_all"
  on public.notificacoes for insert
  to authenticated
  with check (true);

-- Atualizar (marcar como lida): só destinatário
create policy "notificacoes_update_own"
  on public.notificacoes for update
  to authenticated
  using (user_email = auth.email())
  with check (user_email = auth.email());

-- DELETE: só destinatário ou admin
create policy "notificacoes_delete_own_or_admin"
  on public.notificacoes for delete
  to authenticated
  using (user_email = auth.email() or public.current_user_is_admin());


-- ─── 6. EMPRESA_CONFIG (logo + futuras configs globais) ────────────────────
alter table public.empresa_config enable row level security;
select public._drop_all_policies('empresa_config');

create policy "empresa_config_read_all"
  on public.empresa_config for select
  to authenticated
  using (true);

create policy "empresa_config_write_admin"
  on public.empresa_config for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 7. PLANNER_WORKFLOWS + PLANNER_WORKFLOW_STATUSES ──────────────────────
alter table public.planner_workflows enable row level security;
select public._drop_all_policies('planner_workflows');

create policy "planner_workflows_read_all"
  on public.planner_workflows for select
  to authenticated
  using (true);

create policy "planner_workflows_write_admin"
  on public.planner_workflows for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Tabela filha (status por workflow): mesmo padrão
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='planner_workflow_statuses') then
    execute 'alter table public.planner_workflow_statuses enable row level security';
    perform public._drop_all_policies('planner_workflow_statuses');
    execute 'create policy "planner_workflow_statuses_read_all" on public.planner_workflow_statuses for select to authenticated using (true)';
    execute 'create policy "planner_workflow_statuses_write_admin" on public.planner_workflow_statuses for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin())';
  end if;
end$$;


-- ─── 8. AUDITORIA (logs) ───────────────────────────────────────────────────
--      Read-only via app, só admin. INSERT é pra triggers (security definer).
alter table public.auditoria enable row level security;
select public._drop_all_policies('auditoria');

create policy "auditoria_read_admin"
  on public.auditoria for select
  to authenticated
  using (public.current_user_is_admin());

-- Nada de INSERT/UPDATE/DELETE pra authenticated — populado por triggers ou service_role.


-- ─── 9. PROJETOS ───────────────────────────────────────────────────────────
alter table public.projetos enable row level security;
select public._drop_all_policies('projetos');

create policy "projetos_read_all"
  on public.projetos for select
  to authenticated
  using (true);

create policy "projetos_write_admin"
  on public.projetos for all
  to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ─── 10. LIMPEZA: dropa o helper temporário ────────────────────────────────
drop function if exists public._drop_all_policies(text);


-- ─── 11. SANITY CHECK ──────────────────────────────────────────────────────
-- Confirma que tudo tem RLS ON e lista as policies por tabela
-- (rode em separado depois pra inspecionar)
--
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname='public'
-- order by tablename;
--
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname='public'
-- order by tablename, policyname;
