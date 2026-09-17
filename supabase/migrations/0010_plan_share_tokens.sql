-- ============================================================================
-- AuriNutri - Migration 0010
-- Fase 4, Bloco D — compartilhamento de PDF do plano por link (WhatsApp).
--
-- DESAFIO DE SEGURANÇA E COMO FOI RESOLVIDO:
-- O paciente NÃO é um usuário autenticado (decisão D2) — quem abre o link
-- compartilhado não tem sessão nenhuma no Supabase. Isso significa que a
-- leitura precisa acontecer com o papel `anon`, que por padrão não enxerga
-- nada em `plan_share_tokens` nem no bucket `planos` (RLS normal, dono only).
--
-- A tentação seria criar uma policy de SELECT pra `anon` em
-- `plan_share_tokens` ou em `storage.objects` — mas isso abriria uma forma
-- de ENUMERAR todos os links compartilhados ativos (ex: chamando `.list()`
-- na pasta de um profissional), mesmo sem conhecer o token de ninguém.
--
-- A solução usada aqui é a mesma já empregada em handle_new_user e
-- log_audit_event: uma função SECURITY DEFINER (get_shared_plan_pdf), que
-- ignora RLS por dentro mas só devolve alguma coisa se o token EXATO for
-- passado como parâmetro — não existe forma de listar ou adivinhar. Nenhuma
-- policy de SELECT pra `anon` é criada em nenhuma tabela ou no bucket.
--
-- O PDF em si é gerado e enviado ao Storage pelo profissional autenticado
-- (dono do arquivo, RLS normal), que também gera a signed URL (válida por
-- 90 dias) nesse momento — ela fica guardada em `plan_share_tokens.signed_url`.
-- Isso evita precisar de qualquer acesso elevado (service role) em produção
-- pra servir o arquivo depois: o servidor da aplicação só repassa os bytes
-- dessa signed URL já existente, e SÓ faz isso depois de confirmar (via
-- get_shared_plan_pdf) que o token ainda não foi revogado nem expirou pelas
-- NOSSAS próprias regras — é isso que torna a revogação de verdade eficaz
-- (uma signed URL do Supabase, sozinha, não pode ser revogada antes do prazo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket privado 'planos', isolado por pasta — mesmo padrão do bucket
--    'profissional' (Fase 2).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('planos', 'planos', false)
on conflict (id) do nothing;

create policy "planos_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'planos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "planos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'planos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "planos_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'planos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'planos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "planos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'planos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 2. plan_share_tokens — nenhuma policy de acesso público. Só o dono lê/edita
--    (pra gerenciar/revogar); o acesso do paciente passa exclusivamente pela
--    função get_shared_plan_pdf abaixo.
-- ----------------------------------------------------------------------------
create table public.plan_share_tokens (
  id uuid primary key default uuid_generate_v4(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  storage_path text not null,
  signed_url text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.plan_share_tokens is 'Links de compartilhamento do PDF do plano (ex: enviado por WhatsApp). Válidos por 90 dias, revogáveis a qualquer momento pelo profissional.';
comment on column public.plan_share_tokens.token is 'Segredo aleatório e não-adivinhável usado na URL pública /compartilhado/[token]. Nunca exposto via policy de SELECT — só via get_shared_plan_pdf(token exato).';
comment on column public.plan_share_tokens.signed_url is 'Signed URL do Supabase Storage, gerada pelo profissional (dono do arquivo) no momento da criação do link, válida por 90 dias. Reaproveitada em cada acesso — nunca regerada com privilégio elevado.';

create index plan_share_tokens_user_id_idx on public.plan_share_tokens (user_id);
create index plan_share_tokens_meal_plan_id_idx on public.plan_share_tokens (meal_plan_id);

alter table public.plan_share_tokens enable row level security;

create policy "plan_share_tokens_select_own" on public.plan_share_tokens
  for select using (auth.uid() = user_id);
create policy "plan_share_tokens_insert_own" on public.plan_share_tokens
  for insert with check (auth.uid() = user_id);
create policy "plan_share_tokens_update_own" on public.plan_share_tokens
  for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Função pública de resolução do token — SECURITY DEFINER, ignora RLS,
--    mas só retorna algo com o token EXATO. Sem policy de SELECT pra `anon`
--    em lugar nenhum, então não existe forma de listar/enumerar tokens.
-- ----------------------------------------------------------------------------
create or replace function public.get_shared_plan_pdf(p_token text)
returns table (signed_url text, plano_nome text, paciente_nome text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select t.signed_url, mp.nome, pa.nome, t.expires_at
  from public.plan_share_tokens t
  join public.meal_plans mp on mp.id = t.meal_plan_id
  join public.patients pa on pa.id = mp.patient_id
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at > now();
end;
$$;

comment on function public.get_shared_plan_pdf(text) is 'Única forma de um visitante não-autenticado (o paciente) acessar um plano compartilhado. Ignora RLS por dentro (security definer), mas exige o token exato — não é enumerável.';

grant execute on function public.get_shared_plan_pdf(text) to anon, authenticated;
