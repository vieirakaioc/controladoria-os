-- =============================================================================
-- TaskManager v2 / Portal da Controladoria
-- Libera Ad Hoc pra membros (sem afetar rotinas sincronizadas)
-- =============================================================================
--
-- POR QUE EXISTE:
--   O rls-reset-v2.sql original deixou `atividades` admin-only pra writes.
--   Mas membros precisam criar/editar Ad Hocs (tarefas pontuais) pelo /tarefas.
--   Solução: policies específicas pra planner_name = 'Ad Hoc'.
--
-- MANTÉM as policies admin (atividades_write_admin) que continuam permitindo
-- ao admin fazer qualquer coisa. As novas policies adicionam permissões
-- específicas pra membros mexerem APENAS em Ad Hocs.
--
-- IDEMPOTENTE.
-- =============================================================================

-- INSERT de Ad Hoc: qualquer autenticado
drop policy if exists "atividades_insert_adhoc" on public.atividades;
create policy "atividades_insert_adhoc"
  on public.atividades for insert
  to authenticated
  with check (planner_name = 'Ad Hoc');

-- UPDATE de Ad Hoc: qualquer autenticado
drop policy if exists "atividades_update_adhoc" on public.atividades;
create policy "atividades_update_adhoc"
  on public.atividades for update
  to authenticated
  using (planner_name = 'Ad Hoc')
  with check (planner_name = 'Ad Hoc');

-- DELETE de Ad Hoc: qualquer autenticado (botão excluir do drawer)
drop policy if exists "atividades_delete_adhoc" on public.atividades;
create policy "atividades_delete_adhoc"
  on public.atividades for delete
  to authenticated
  using (planner_name = 'Ad Hoc');


-- ─── Sanity check ──────────────────────────────────────────────────────────
-- select policyname, cmd, qual, with_check from pg_policies
-- where schemaname = 'public' and tablename = 'atividades'
-- order by policyname;
