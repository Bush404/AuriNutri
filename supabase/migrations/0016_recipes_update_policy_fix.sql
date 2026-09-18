-- ============================================================================
-- 0016_recipes_update_policy_fix.sql
--
-- Fase 6, Bloco B — corrige um bug real encontrado testando "excluir
-- receita" (soft delete): a atualização de `deleted_at` falhava com
-- "new row violates row-level security policy for table recipes" (42501),
-- mesmo a política `recipes_update_own` (e `recipe_ingredients_update_own`)
-- usando o mesmo padrão de USING sem WITH CHECK já usado em appointments/
-- tasks (que funciona). Em vez de depender do comportamento implícito do
-- Postgres de reaproveitar USING como WITH CHECK quando omitido, este
-- ajuste declara WITH CHECK explicitamente — elimina qualquer ambiguidade.
-- ============================================================================

drop policy if exists "recipes_update_own" on public.recipes;
create policy "recipes_update_own" on public.recipes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recipe_ingredients_update_own" on public.recipe_ingredients;
create policy "recipe_ingredients_update_own" on public.recipe_ingredients
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
