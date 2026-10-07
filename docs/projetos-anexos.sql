-- Execute uma vez no SQL Editor do Supabase (pode ser executado novamente).
-- Arquivos privados; leitura segue o acesso à tabela projetos.
-- Inclusão e exclusão seguem a gestão de projetos: administradores do portal.
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('projetos-anexos', 'projetos-anexos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists projetos_anexos_leitura on storage.objects;
create policy projetos_anexos_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'projetos-anexos'
  and exists (select 1 from public.projetos p where p.id::text = (storage.foldername(name))[1])
);

drop policy if exists projetos_anexos_insercao on storage.objects;
create policy projetos_anexos_insercao on storage.objects for insert to authenticated
with check (
  bucket_id = 'projetos-anexos'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  and exists (select 1 from public.projetos p where p.id::text = (storage.foldername(name))[1])
  and array_length(storage.foldername(name), 1) = 1
);

drop policy if exists projetos_anexos_exclusao on storage.objects;
create policy projetos_anexos_exclusao on storage.objects for delete to authenticated
using (
  bucket_id = 'projetos-anexos'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  and exists (select 1 from public.projetos p where p.id::text = (storage.foldername(name))[1])
);

commit;
