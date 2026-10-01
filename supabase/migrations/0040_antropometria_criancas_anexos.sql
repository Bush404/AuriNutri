-- ============================================================================
-- 0040 — Fase 15, Blocos B e C (Roadmap 2).
--
-- Só acrescenta. Nenhuma linha existente é alterada: toda avaliação antiga
-- vira tipo 'adulto' pelo valor padrão. Seguro de aplicar com o site no ar.
--
-- B. anthropometric_assessments.tipo — 'adulto' (Bloco A) ou 'crianca'
--    (0 a 19 anos: peso, altura/comprimento e 3 dobras; escore-z/percentil
--    pelas tabelas da OMS, calculados pela aplicação em src/lib/growth/).
--
-- C. anthropometric_attachments — relatório externo anexado (bioimpedância,
--    DEXA, laudo) com data e observação, e opcionalmente os principais
--    números para entrarem na evolução. Mesmo padrão dos exames (Fase 7):
--    arquivo no bucket privado 'profissional' (pasta <user_id>/antropometria-anexos/,
--    já coberta pelas políticas de pasta própria da migration 0004), URL
--    assinada só sob demanda, soft delete por função security definer (0017).
-- ============================================================================

alter table public.anthropometric_assessments
  add column if not exists tipo text not null default 'adulto' check (tipo in ('adulto', 'crianca'));

comment on column public.anthropometric_assessments.tipo is 'adulto = adultos e idosos (Fase 15, Bloco A); crianca = 0 a 19 anos, curvas da OMS (Bloco B).';

create table if not exists public.anthropometric_attachments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data_avaliacao date not null,
  titulo text check (char_length(titulo) <= 120),
  observacoes text,
  -- Path no bucket privado 'profissional' — nunca uma URL.
  arquivo_path text not null,
  arquivo_nome text,
  -- Números opcionais para a evolução (digitados do relatório).
  peso_kg numeric(6, 2) check (peso_kg > 0),
  percentual_gordura numeric(5, 2) check (percentual_gordura > 0),
  massa_livre_gordura_kg numeric(6, 2) check (massa_livre_gordura_kg > 0),
  massa_muscular_kg numeric(6, 2) check (massa_muscular_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.anthropometric_attachments is 'Relatório antropométrico externo anexado (Fase 15, Bloco C). Os números opcionais entram na evolução junto com as avaliações.';
comment on column public.anthropometric_attachments.arquivo_path is 'Path no bucket privado "profissional" (pasta <user_id>/antropometria-anexos/) — nunca uma URL. Assinada sob demanda.';
comment on column public.anthropometric_attachments.deleted_at is 'Soft delete — exclusão via soft_delete_anthropometric_attachment (padrão 0017), nunca UPDATE direto.';

create index if not exists anthropometric_attachments_user_id_idx on public.anthropometric_attachments (user_id) where deleted_at is null;
create index if not exists anthropometric_attachments_patient_id_idx on public.anthropometric_attachments (patient_id) where deleted_at is null;

drop trigger if exists set_updated_at on public.anthropometric_attachments;
create trigger set_updated_at before update on public.anthropometric_attachments
  for each row execute procedure public.set_updated_at();

alter table public.anthropometric_attachments enable row level security;

create policy "anthropometric_attachments_select_own" on public.anthropometric_attachments
  for select using (auth.uid() = user_id and deleted_at is null);
create policy "anthropometric_attachments_insert_own" on public.anthropometric_attachments
  for insert with check (auth.uid() = user_id);
create policy "anthropometric_attachments_update_own" on public.anthropometric_attachments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "anthropometric_attachments_delete_own" on public.anthropometric_attachments
  for delete using (auth.uid() = user_id);

create or replace function public.soft_delete_anthropometric_attachment(attachment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anthropometric_attachments
  set deleted_at = now()
  where id = attachment_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_anthropometric_attachment(uuid) from public;
grant execute on function public.soft_delete_anthropometric_attachment(uuid) to authenticated;
