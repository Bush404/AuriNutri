-- ============================================================================
-- 0038 — Fase 14 (Roadmap 2): anamnese em texto livre + modelos próprios.
--
-- Só acrescenta. Nenhuma linha existente é alterada ou apagada: seguro de
-- aplicar com o site antigo no ar.
--
-- 1. anamnesis.conteudo — o texto da anamnese (HTML limpo pelo servidor antes
--    de gravar, ver src/lib/rich-text.ts). As colunas por tema antigas
--    (queixa_principal, historico_saude, ...) continuam no banco, intactas.
--    Anamnese antiga (conteudo nulo) é montada na hora a partir delas pela
--    aplicação, e só ganha `conteudo` quando o profissional salvar de novo —
--    nenhuma conversão em massa, nenhum risco de perda.
-- 2. anamnesis_templates — "Meus modelos de anamnese" de cada profissional.
--    Exclusão é real (DELETE), não lógica: modelo não é registro clínico, e a
--    anamnese criada a partir dele é uma cópia independente.
--    Modelos prontos do AuriNutri (globais) ficaram para depois, por decisão
--    da responsável pelo produto (25/09/2026).
-- ============================================================================

alter table public.anamnesis add column if not exists conteudo text;
comment on column public.anamnesis.conteudo is 'Texto livre da anamnese (HTML sanitizado no servidor). Nulo = registro antigo, exibido a partir das colunas por tema.';

create table if not exists public.anamnesis_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  conteudo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.anamnesis_templates is 'Modelos de anamnese do próprio profissional (Fase 14). Nova anamnese a partir de um modelo copia o conteúdo — editar o modelo depois não muda anamneses já criadas.';

create index if not exists anamnesis_templates_user_id_idx on public.anamnesis_templates (user_id);

drop trigger if exists set_updated_at on public.anamnesis_templates;
create trigger set_updated_at before update on public.anamnesis_templates
  for each row execute procedure public.set_updated_at();

alter table public.anamnesis_templates enable row level security;

create policy "anamnesis_templates_select_own" on public.anamnesis_templates
  for select using (auth.uid() = user_id);
create policy "anamnesis_templates_insert_own" on public.anamnesis_templates
  for insert with check (auth.uid() = user_id);
-- `with check` explícito no UPDATE (sem ele o Postgres já reaplica o `using`
-- na linha nova; fica escrito para deixar claro que trocar o user_id é barrado).
create policy "anamnesis_templates_update_own" on public.anamnesis_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "anamnesis_templates_delete_own" on public.anamnesis_templates
  for delete using (auth.uid() = user_id);
