-- ============================================================================
-- AuriNutri - Migration 0024
-- Fase 8, Bloco B (redesenho) — Central de Envio ganha "Evolução Física" e
-- "Impressos" (receita avulsa + PDF do computador do profissional), sempre
-- como PDF de verdade, não texto solto no WhatsApp.
--
-- Generaliza o MESMO desenho de segurança da migration 0010
-- (plan_share_tokens/get_shared_plan_pdf) para qualquer tipo de documento,
-- em vez de duplicar tabela+função+bucket a cada novo tipo. `plan_share_tokens`
-- continua existindo sem nenhuma alteração — o link do Plano Alimentar não
-- muda (decisão do usuário: manter como está).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket privado 'documentos', isolado por pasta — mesmo padrão de 'planos'.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "documentos_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documentos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documentos_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documentos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 2. document_share_tokens — mesmo papel de plan_share_tokens, mas genérico
--    por `tipo`. `referencia_id` aponta para o recurso de origem quando faz
--    sentido reaproveitar um link já existente (ex: a mesma receita
--    compartilhada de novo) — nulo para 'arquivo' (upload avulso, sempre um
--    link novo). Nenhuma policy de SELECT pra `anon`; acesso do paciente
--    passa exclusivamente por get_shared_document abaixo.
-- ----------------------------------------------------------------------------
create table public.document_share_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  tipo text not null check (tipo in ('antropometria', 'receita', 'arquivo')),
  referencia_id uuid,
  titulo text not null,
  token text not null unique,
  storage_path text not null,
  signed_url text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.document_share_tokens is 'Links de compartilhamento de PDFs enviados pela Central de Envio (Evolução Física, receita avulsa, arquivo do computador) — generaliza plan_share_tokens (migration 0010) para tipos de documento além do plano alimentar.';
comment on column public.document_share_tokens.referencia_id is 'Id do recurso de origem (ex: recipes.id quando tipo=receita) — usado para reaproveitar um link ainda válido em vez de gerar um novo a cada clique. Nulo para tipo=arquivo.';
comment on column public.document_share_tokens.token is 'Segredo aleatório e não-adivinhável usado na URL pública /compartilhado/[token]. Nunca exposto via policy de SELECT — só via get_shared_document(token exato).';

create index document_share_tokens_user_id_idx on public.document_share_tokens (user_id);
create index document_share_tokens_patient_id_idx on public.document_share_tokens (patient_id);
create index document_share_tokens_tipo_referencia_idx on public.document_share_tokens (tipo, referencia_id);

alter table public.document_share_tokens enable row level security;

create policy "document_share_tokens_select_own" on public.document_share_tokens
  for select using (auth.uid() = user_id);
create policy "document_share_tokens_insert_own" on public.document_share_tokens
  for insert with check (auth.uid() = user_id);
create policy "document_share_tokens_update_own" on public.document_share_tokens
  for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Função pública de resolução do token — mesmo padrão de
--    get_shared_plan_pdf (migration 0010): SECURITY DEFINER, ignora RLS, mas
--    só retorna algo com o token EXATO. Sem policy de SELECT pra `anon` em
--    lugar nenhum, então não existe forma de listar/enumerar tokens.
-- ----------------------------------------------------------------------------
create or replace function public.get_shared_document(p_token text)
returns table (signed_url text, titulo text, paciente_nome text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select t.signed_url, t.titulo, pa.nome, t.expires_at
  from public.document_share_tokens t
  join public.patients pa on pa.id = t.patient_id
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at > now();
end;
$$;

comment on function public.get_shared_document(text) is 'Única forma de um visitante não-autenticado (o paciente) acessar um documento compartilhado pela Central de Envio. Ignora RLS por dentro (security definer), mas exige o token exato — não é enumerável.';

grant execute on function public.get_shared_document(text) to anon, authenticated;
