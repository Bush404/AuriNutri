-- ============================================================================
-- 0044 — Fase 17, Bloco C (Roadmap 2): alimentos favoritos.
--
-- Só acrescenta (tabela nova). Seguro de aplicar com o site no ar.
--
-- food_favorites — a estrela da busca de alimentos da refeição (como no
-- WebDiet). Uma linha por profissional + alimento; serve tanto para
-- alimentos da TACO (globais) quanto para os do próprio profissional.
-- Desfavoritar apaga a linha (não é dado clínico: sem soft delete nem
-- auditoria).
-- ============================================================================

create table if not exists public.food_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

comment on table public.food_favorites is 'Alimentos favoritados pelo profissional na busca da refeição (Fase 17).';

alter table public.food_favorites enable row level security;

create policy "food_favorites_select_own" on public.food_favorites
  for select using (auth.uid() = user_id);
-- Só pode favoritar alimento que enxerga: global (TACO) ou o próprio.
create policy "food_favorites_insert_own" on public.food_favorites
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.foods f
      where f.id = food_id and (f.is_global or f.user_id = auth.uid())
    )
  );
create policy "food_favorites_delete_own" on public.food_favorites
  for delete using (auth.uid() = user_id);
