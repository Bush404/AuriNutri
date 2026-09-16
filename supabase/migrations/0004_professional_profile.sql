-- ============================================================================
-- 0004_professional_profile.sql
--
-- Fase 2, Bloco A (backend) — identidade profissional do nutricionista.
--
-- 1) Novos campos em profiles, todos nullable: não quebram o trigger
--    handle_new_user (que só grava id/nome/email) nem exigem backfill dos
--    profiles já existentes.
-- 2) Bucket de Storage 'profissional', PRIVADO, para logo/assinatura.
-- 3) Políticas RLS em storage.objects restringindo cada usuário à própria
--    pasta dentro do bucket (path no formato "<user_id>/arquivo.ext").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES — campos de identidade profissional
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists telefone text,
  add column if not exists crn_uf text,
  add column if not exists especialidade text,
  add column if not exists logo_url text,
  add column if not exists assinatura_url text,
  add column if not exists cor_marca text,
  add column if not exists endereco text,
  add column if not exists bio text;

comment on column public.profiles.crn_uf is 'Número do CRN + UF, ex: "12345/SP" — validado na camada de aplicação (Zod), não no banco';
comment on column public.profiles.logo_url is 'Path do arquivo no bucket privado "profissional" (não é URL pública)';
comment on column public.profiles.assinatura_url is 'Path do arquivo no bucket privado "profissional" (não é URL pública)';
comment on column public.profiles.cor_marca is 'Cor de marca do profissional em hex, ex: "#2563eb"';

-- Nenhuma policy nova em profiles: select/update "own" já cobrem as colunas
-- novas por serem row-level, e profiles continua sem policy de INSERT
-- (criado apenas pelo trigger security definer handle_new_user).

-- ----------------------------------------------------------------------------
-- 2. STORAGE — bucket privado 'profissional'
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profissional', 'profissional', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. STORAGE — políticas de isolamento por pasta
--
-- Convenção de path exigida: o primeiro segmento do caminho do arquivo é o
-- auth.uid() do dono, ex. "3f2b.../logo.png". storage.foldername(name)
-- retorna o path quebrado em array pelos "/" (sem o nome do arquivo em si),
-- então (storage.foldername(name))[1] é sempre a "pasta" de topo do objeto.
-- Comparando esse segmento com auth.uid() do usuário autenticado, cada
-- policy só permite a operação quando o arquivo está dentro da própria
-- pasta do dono — um usuário nunca consegue ler, sobrescrever ou apagar
-- arquivo em "outro-uid/..." porque a condição falha e a policy nega.
-- ----------------------------------------------------------------------------
create policy "profissional_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profissional'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profissional_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profissional'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profissional_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profissional'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profissional'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profissional_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profissional'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
