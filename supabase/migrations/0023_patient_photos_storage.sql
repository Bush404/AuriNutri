-- ============================================================================
-- 0023_patient_photos_storage.sql
--
-- Fase 7, Bloco C — bucket de storage SEPARADO e privado para fotos de
-- evolução, com política própria — não reutiliza o bucket 'profissional'
-- da Fase 2 (que guarda logo/assinatura/exames), justamente por ser dado
-- mais sensível (biometria) e merecer isolamento próprio. Isolamento por
-- pasta "<user_id>/<patient_id>/arquivo.ext" — mesmo padrão de
-- (storage.foldername(name))[1] = auth.uid() já usado em 'profissional' e
-- 'receitas'; a subpasta por paciente é só organização, não é uma segunda
-- fronteira de segurança (o profissional já tem acesso a todos os
-- pacientes dele).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('fotos-evolucao', 'fotos-evolucao', false)
on conflict (id) do nothing;

create policy "fotos_evolucao_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-evolucao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos_evolucao_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-evolucao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Sem policy de UPDATE: uma foto de evolução não é "substituída" — se o
-- profissional errou o arquivo, exclui o registro (que apaga o arquivo,
-- ver soft_delete_patient_photo) e envia de novo.

create policy "fotos_evolucao_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-evolucao'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
