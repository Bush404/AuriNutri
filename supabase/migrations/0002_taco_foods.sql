-- ============================================================================
-- AuriNutri - Migration 0002
-- Adiciona suporte à Tabela Brasileira de Composição de Alimentos (TACO)
-- como base global de alimentos, mantendo os alimentos personalizados de
-- cada nutricionista intactos.
--
-- DECISÕES DE ARQUITETURA (ver resumo completo na resposta que acompanha
-- esta migration):
--   1. A coluna `foods.user_id` foi mantida (apenas tornada nullable) em vez
--      de renomeada, para não quebrar nenhuma política/código existente.
--      user_id = null  =>  alimento global (TACO).
--      user_id = <uuid> => alimento personalizado daquele nutricionista.
--   2. Os 5 macronutrientes centrais deixam de ser NOT NULL, pois a fonte
--      original da TACO pode marcar um valor como "Tr" (traço) ou "NA"
--      (não analisado) — nesses casos a coluna fica NULL e o motivo exato
--      é preservado em `valores_especiais` (jsonb), nunca convertido para 0.
--   3. `meal_items` passa a guardar um SNAPSHOT nutricional completo no
--      momento em que o alimento é adicionado à refeição. Isso garante que
--      um plano alimentar antigo NUNCA mude se o alimento de origem for
--      editado ou removido depois.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FOODS: novas colunas de origem, micronutrientes e valores especiais
-- ----------------------------------------------------------------------------
alter table public.foods
  alter column user_id drop not null;

alter table public.foods
  add column if not exists fonte text not null default 'personalizado'
    check (fonte in ('taco', 'personalizado')),
  add column if not exists fonte_descricao text,
  add column if not exists is_global boolean not null default false,
  add column if not exists codigo_taco integer unique,
  -- Macros centrais: relaxados para nullable (ver decisão #2 acima).
  add column if not exists umidade_g numeric(7, 2),
  add column if not exists cinzas_g numeric(7, 2),
  add column if not exists colesterol_mg numeric(9, 2),
  add column if not exists calcio_mg numeric(9, 2),
  add column if not exists magnesio_mg numeric(9, 2),
  add column if not exists manganes_mg numeric(9, 3),
  add column if not exists fosforo_mg numeric(9, 2),
  add column if not exists ferro_mg numeric(9, 3),
  add column if not exists sodio_mg numeric(9, 2),
  add column if not exists potassio_mg numeric(9, 2),
  add column if not exists cobre_mg numeric(9, 3),
  add column if not exists zinco_mg numeric(9, 3),
  add column if not exists retinol_mcg numeric(9, 2),
  add column if not exists re_mcg numeric(9, 2),
  add column if not exists rae_mcg numeric(9, 2),
  add column if not exists tiamina_mg numeric(9, 3),
  add column if not exists riboflavina_mg numeric(9, 3),
  add column if not exists piridoxina_mg numeric(9, 3),
  add column if not exists niacina_mg numeric(9, 3),
  add column if not exists vitamina_c_mg numeric(9, 2),
  add column if not exists gordura_saturada_g numeric(7, 2),
  add column if not exists gordura_monoinsaturada_g numeric(7, 2),
  add column if not exists gordura_poliinsaturada_g numeric(7, 2),
  -- Preserva o motivo exato quando um valor não é um número:
  -- {"fibras_g": "traco"} | "nao_analisado" | "nao_informado"
  add column if not exists valores_especiais jsonb not null default '{}'::jsonb;

-- Os macros centrais agora podem ser NULL (fonte original sem o dado).
-- O valor 0 deixa de ser o default para não mascarar "ausência de dado"
-- como "zero calorias".
alter table public.foods
  alter column calorias_kcal drop not null,
  alter column calorias_kcal drop default,
  alter column proteinas_g drop not null,
  alter column proteinas_g drop default,
  alter column carboidratos_g drop not null,
  alter column carboidratos_g drop default,
  alter column gorduras_g drop not null,
  alter column gorduras_g drop default,
  alter column fibras_g drop not null,
  alter column fibras_g drop default;

-- Alimento global nunca pertence a um usuário e vice-versa.
alter table public.foods drop constraint if exists foods_global_ou_pessoal_check;
alter table public.foods
  add constraint foods_global_ou_pessoal_check check (
    (is_global = true and user_id is null and fonte = 'taco')
    or
    (is_global = false and user_id is not null and fonte = 'personalizado')
  );

create index if not exists foods_is_global_idx on public.foods (is_global);
create index if not exists foods_fonte_idx on public.foods (fonte);

comment on column public.foods.user_id is 'NULL para alimentos globais (TACO); dono do alimento quando personalizado.';
comment on column public.foods.fonte is 'Origem do alimento: taco (base oficial) ou personalizado (cadastro do nutricionista).';
comment on column public.foods.codigo_taco is 'Número do alimento na Tabela Brasileira de Composição de Alimentos (TACO), usado para importação idempotente.';
comment on column public.foods.valores_especiais is 'Mapa {coluna: motivo} para valores não numéricos preservados da fonte original (traco | nao_analisado | nao_informado).';

-- ----------------------------------------------------------------------------
-- 2. MEAL_ITEMS: snapshot nutricional no momento em que o item foi adicionado
-- ----------------------------------------------------------------------------
alter table public.meal_items
  add column if not exists nome_alimento text,
  add column if not exists fonte_alimento text check (fonte_alimento in ('taco', 'personalizado')),
  add column if not exists fonte_descricao_alimento text,
  add column if not exists porcao_referencia_g numeric(7, 2),
  add column if not exists calorias_kcal numeric(9, 2),
  add column if not exists proteinas_g numeric(9, 2),
  add column if not exists carboidratos_g numeric(9, 2),
  add column if not exists gorduras_g numeric(9, 2),
  add column if not exists fibras_g numeric(9, 2);

-- Backfill: preenche o snapshot dos itens já existentes com os dados atuais
-- do alimento vinculado (é o melhor histórico possível para dados criados
-- antes desta migration).
update public.meal_items mi
set
  nome_alimento = f.nome,
  fonte_alimento = 'personalizado',
  fonte_descricao_alimento = 'Cadastro próprio do nutricionista',
  porcao_referencia_g = f.porcao_referencia_g,
  calorias_kcal = coalesce(f.calorias_kcal, 0),
  proteinas_g = coalesce(f.proteinas_g, 0),
  carboidratos_g = coalesce(f.carboidratos_g, 0),
  gorduras_g = coalesce(f.gorduras_g, 0),
  fibras_g = coalesce(f.fibras_g, 0)
from public.foods f
where mi.food_id = f.id
  and mi.nome_alimento is null;

-- A partir de agora, todo novo item de refeição É OBRIGADO a trazer seu
-- próprio snapshot (aplicado na camada de Server Actions).
alter table public.meal_items
  alter column nome_alimento set not null,
  alter column fonte_alimento set not null,
  alter column porcao_referencia_g set not null,
  alter column calorias_kcal set not null,
  alter column proteinas_g set not null,
  alter column carboidratos_g set not null,
  alter column gorduras_g set not null,
  alter column fibras_g set not null;

-- food_id passa a ser apenas uma referência "de rastreabilidade": se o
-- alimento original (personalizado) for excluído, o histórico do plano
-- é preservado via snapshot e o vínculo apenas vira NULL.
alter table public.meal_items drop constraint if exists meal_items_food_id_fkey;
alter table public.meal_items alter column food_id drop not null;
alter table public.meal_items
  add constraint meal_items_food_id_fkey
  foreign key (food_id) references public.foods (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. RLS: alimentos globais (TACO) são visíveis a todos, mas só o dono pode
--    escrever nos seus próprios alimentos personalizados. Ninguém além do
--    processo de importação (service role, que ignora RLS) pode inserir,
--    editar ou excluir um alimento global.
-- ----------------------------------------------------------------------------
drop policy if exists "foods_select_own" on public.foods;
drop policy if exists "foods_insert_own" on public.foods;
drop policy if exists "foods_update_own" on public.foods;
drop policy if exists "foods_delete_own" on public.foods;

create policy "foods_select_global_or_own" on public.foods
  for select using (is_global = true or auth.uid() = user_id);

create policy "foods_insert_own_personal" on public.foods
  for insert with check (auth.uid() = user_id and is_global = false);

create policy "foods_update_own_personal" on public.foods
  for update
  using (auth.uid() = user_id and is_global = false)
  with check (auth.uid() = user_id and is_global = false);

create policy "foods_delete_own_personal" on public.foods
  for delete using (auth.uid() = user_id and is_global = false);
