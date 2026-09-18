-- ============================================================================
-- 0015_recipes_storage.sql
--
-- Fase 6, Bloco B — bucket de imagens de receita. Mesmo padrão do bucket
-- 'profissional' (migration 0004): privado, isolado por pasta
-- "<user_id>/arquivo.ext", URL de acesso sempre assinada (nunca pública).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('receitas', 'receitas', false)
on conflict (id) do nothing;

create policy "receitas_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receitas_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receitas_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'receitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receitas_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receitas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
