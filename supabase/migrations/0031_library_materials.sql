-- ============================================================================
-- 0031_library_materials.sql
--
-- Fase 10 (parcial) — biblioteca PESSOAL do profissional. A parte de
-- comunidade/compartilhamento entre profissionais fica de fora (adiada,
-- depende de base de usuários ativa — ver MASTER_DEVELOPMENT_PLAN.md).
--
-- `visibilidade` só aceita 'privado' por ora — o campo existe desde já para
-- que uma futura Fase de comunidade seja uma migração aditiva (relaxar o
-- CHECK e criar as tabelas de compartilhamento), nunca uma refatoração do
-- schema existente.
--
-- Um material nasce de UMA das duas formas: escrito direto (`conteudo`) ou
-- arquivo enviado (`arquivo_path`, PDF/imagem no bucket 'profissional' da
-- Fase 2) — nunca as duas, nunca nenhuma (mesmo espírito do CHECK de
-- food_id/recipe_id em meal_items).
-- ============================================================================

create table public.library_materials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text not null check (tipo in ('orientacao', 'material_educativo', 'protocolo', 'checklist', 'outro')),
  conteudo text,
  arquivo_path text,
  tags text[] not null default '{}',
  visibilidade text not null default 'privado' check (visibilidade in ('privado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint library_materials_conteudo_xor_arquivo check (
    (conteudo is not null and arquivo_path is null) or (conteudo is null and arquivo_path is not null)
  )
);

comment on column public.library_materials.conteudo is 'Material escrito direto no sistema (editor de texto simples). Mutuamente exclusivo com arquivo_path.';
comment on column public.library_materials.arquivo_path is 'Path no bucket privado ''profissional'' (Fase 2), pasta "<user_id>/biblioteca/...". PDF ou imagem. Mutuamente exclusivo com conteudo.';
comment on column public.library_materials.visibilidade is 'Só ''privado'' por ora — compartilhamento entre profissionais (comunidade) é Fase 10 futura, fora de escopo aqui.';
comment on column public.library_materials.deleted_at is 'Soft delete — mesmo padrão de recipes.deleted_at (migration 0013).';

create index library_materials_user_id_idx on public.library_materials (user_id) where deleted_at is null;
create index library_materials_tags_idx on public.library_materials using gin (tags);

drop trigger if exists set_updated_at on public.library_materials;
create trigger set_updated_at before update on public.library_materials
  for each row execute procedure public.set_updated_at();

alter table public.library_materials enable row level security;

create policy "library_materials_select_own" on public.library_materials
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "library_materials_insert_own" on public.library_materials
  for insert with check (auth.uid() = user_id);
create policy "library_materials_update_own" on public.library_materials
  for update using (auth.uid() = user_id);
create policy "library_materials_delete_own" on public.library_materials
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Soft delete via função SECURITY DEFINER — mesmo padrão obrigatório desde a
-- migration 0017 (a policy de SELECT com `deleted_at is null` faz o Postgres
-- rejeitar o UPDATE que torna a própria linha invisível por ela mesma).
-- ----------------------------------------------------------------------------
create or replace function public.soft_delete_library_material(material_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.library_materials
  set deleted_at = now()
  where id = material_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_library_material(uuid) from public;
grant execute on function public.soft_delete_library_material(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Central de Envio (migration 0024) ganha o tipo 'material' — reaproveita
-- 100% de document_share_tokens/get_shared_document, mesmo padrão já usado
-- para 'recibo' (migration 0028): só altera o CHECK da coluna tipo.
-- ----------------------------------------------------------------------------
alter table public.document_share_tokens drop constraint if exists document_share_tokens_tipo_check;
alter table public.document_share_tokens add constraint document_share_tokens_tipo_check
  check (tipo in ('antropometria', 'receita', 'arquivo', 'recibo', 'material'));
