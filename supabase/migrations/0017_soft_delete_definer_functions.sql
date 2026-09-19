-- ============================================================================
-- 0017_soft_delete_definer_functions.sql
--
-- Corrige um bug real de RLS afetando TODA exclusão lógica (soft delete) do
-- projeto: `recipes`, `anthropometric_assessments`, `meal_plans`, `meals`,
-- `meal_items`, `appointments`, `tasks`. Todas seguem o mesmo padrão da
-- migration 0005: a policy de SELECT filtra `deleted_at is null`, e o soft
-- delete é um UPDATE que seta `deleted_at`. O Postgres trata a transição
-- "linha deixa de ser visível pela própria policy de SELECT no momento do
-- UPDATE" como uma violação de RLS ("new row violates row-level security
-- policy"), mesmo a policy de UPDATE (`..._update_own`) permitindo a
-- operação em si — reproduzido e confirmado manualmente via SQL direto
-- (rodando como role `authenticated` com o JWT do usuário) tanto em
-- `recipes` quanto em `anthropometric_assessments`.
--
-- A policy de SELECT com o filtro `deleted_at is null` é proposital (ver
-- comentário da migration 0005: a garantia de "excluído fica invisível"
-- precisa morar no banco, não na disciplina da aplicação) — não é para ser
-- removida. A correção é mover a operação de soft delete para uma função
-- `SECURITY DEFINER`, que roda com os privilégios do dono da função
-- (contornando RLS nesse UPDATE específico), mas replica a MESMA checagem
-- de posse (`user_id = auth.uid()`) explicitamente no WHERE — a garantia
-- continua vivendo no banco, só que na função em vez de na policy.
--
-- Cada função retorna `boolean`: true se encontrou e excluiu uma linha
-- pertencente ao usuário autenticado, false caso contrário (id inexistente,
-- de outro usuário, ou já excluído) — a Server Action correspondente trata
-- `false` como "não encontrado" em vez de silenciosamente reportar sucesso.
-- ============================================================================

create or replace function public.soft_delete_recipe(recipe_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.recipes
  set deleted_at = now()
  where id = recipe_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_assessment(assessment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anthropometric_assessments
  set deleted_at = now()
  where id = assessment_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_meal_plan(plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meal_plans
  set deleted_at = now()
  where id = plan_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_meal(meal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meals
  set deleted_at = now()
  where id = meal_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_meal_item(item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meal_items
  set deleted_at = now()
  where id = item_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_appointment(appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.appointments
  set deleted_at = now()
  where id = appointment_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.soft_delete_task(task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set deleted_at = now()
  where id = task_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

-- Nenhuma dessas funções deve ser executável por `anon` ou `public` — só por
-- um usuário autenticado (a checagem de posse é interna, mas ainda exige
-- estar logado; sem isso, auth.uid() seria null e `found` sempre false, o
-- que já é seguro, mas revoke explícito documenta a intenção).
revoke all on function public.soft_delete_recipe(uuid) from public;
revoke all on function public.soft_delete_assessment(uuid) from public;
revoke all on function public.soft_delete_meal_plan(uuid) from public;
revoke all on function public.soft_delete_meal(uuid) from public;
revoke all on function public.soft_delete_meal_item(uuid) from public;
revoke all on function public.soft_delete_appointment(uuid) from public;
revoke all on function public.soft_delete_task(uuid) from public;

grant execute on function public.soft_delete_recipe(uuid) to authenticated;
grant execute on function public.soft_delete_assessment(uuid) to authenticated;
grant execute on function public.soft_delete_meal_plan(uuid) to authenticated;
grant execute on function public.soft_delete_meal(uuid) to authenticated;
grant execute on function public.soft_delete_meal_item(uuid) to authenticated;
grant execute on function public.soft_delete_appointment(uuid) to authenticated;
grant execute on function public.soft_delete_task(uuid) to authenticated;
