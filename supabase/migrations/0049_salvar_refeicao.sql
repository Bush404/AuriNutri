-- ============================================================================
-- 0049 — Fase 19 (Roadmap 2): "Salvar alterações" da janela da refeição
-- grava tudo numa transação só — ou tudo, ou nada.
--
-- A ação salvarRefeicao (src/lib/actions/meal-editor.ts) confere tudo e monta
-- cada linha (com a cópia nutricional tirada no servidor) e chama esta função
-- uma vez. Se qualquer passo falhar, o Postgres desfaz os anteriores e a
-- refeição continua exatamente como estava antes do clique.
--
-- SECURITY INVOKER (o padrão): roda com as permissões de quem está logado, então
-- as políticas de RLS de meals, meal_items e meal_item_substitutions valem como
-- em qualquer outra gravação. A única exceção é a "lixeira" do item, que usa a
-- função soft_delete_meal_item (0017) — a mesma que a aplicação já usava.
--
-- Só cria uma função: seguro de aplicar com o site no ar, nenhum dado muda.
-- ============================================================================

create or replace function public.salvar_refeicao(
  p_meal_id uuid,
  -- {"nome": "...", "horario": "08:30" | null, "observacoes": "<p>...</p>" | null}
  p_refeicao jsonb,
  -- [{"id": uuid | null, "linha": {colunas de meal_items},
  --   "substitutos": [{"id": uuid | null, "linha": {colunas de meal_item_substitutions}}]}]
  p_itens jsonb,
  p_itens_removidos uuid[],
  p_subs_removidos uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_sub jsonb;
  v_item_id uuid;
  v_id uuid;
  v_linha jsonb;
  v_cols text;
  v_vals text;
  v_set text;
  v_n integer;
  -- Colunas que vêm da linha montada no servidor; id, dono, ligação e datas são definidos aqui.
  v_proibidas text[] := array['id', 'user_id', 'created_at', 'deleted_at', 'meal_id', 'meal_item_id'];
begin
  if v_user is null then
    raise exception 'Sessão expirada. Faça login novamente.';
  end if;

  -- 1. A refeição (a RLS garante que é do profissional logado).
  update public.meals
  set nome = p_refeicao ->> 'nome',
      horario = nullif(p_refeicao ->> 'horario', '')::time,
      observacoes = nullif(p_refeicao ->> 'observacoes', '')
  where id = p_meal_id;
  if not found then
    raise exception 'Refeição não encontrada.';
  end if;

  -- 2. Substitutos tirados (só os desta refeição).
  if coalesce(array_length(p_subs_removidos, 1), 0) > 0 then
    delete from public.meal_item_substitutions s
    where s.id = any (p_subs_removidos)
      and s.meal_item_id in (select i.id from public.meal_items i where i.meal_id = p_meal_id);
  end if;

  -- 3. Alimentos tirados: para a lixeira, como sempre (soft delete).
  foreach v_id in array coalesce(p_itens_removidos, '{}'::uuid[]) loop
    if not exists (select 1 from public.meal_items i where i.id = v_id and i.meal_id = p_meal_id) then
      raise exception 'Um alimento desta refeição não foi encontrado.';
    end if;
    if not public.soft_delete_meal_item(v_id) then
      raise exception 'Não foi possível tirar um alimento da refeição.';
    end if;
  end loop;

  -- 4. Alimentos (na ordem da tela) e os substitutos de cada um.
  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_linha := v_item -> 'linha';

    select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', '), string_agg(format('%I = r.%I', k, k), ', ')
    into v_cols, v_vals, v_set
    from jsonb_object_keys(v_linha) k
    where k <> all (v_proibidas)
      and k in (select attname from pg_attribute
                where attrelid = 'public.meal_items'::regclass and attnum > 0 and not attisdropped);

    if v_item ->> 'id' is null then
      execute format(
        'insert into public.meal_items (%s, meal_id, user_id) select %s, $2, $3 from jsonb_populate_record(null::public.meal_items, $1) r returning id',
        v_cols, v_vals)
      using v_linha, p_meal_id, v_user
      into v_item_id;
    else
      v_item_id := (v_item ->> 'id')::uuid;
      execute format(
        'update public.meal_items t set %s from jsonb_populate_record(null::public.meal_items, $1) r where t.id = $2 and t.meal_id = $3',
        v_set)
      using v_linha, v_item_id, p_meal_id;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'Um alimento desta refeição não foi encontrado.';
      end if;
    end if;

    for v_sub in select value from jsonb_array_elements(coalesce(v_item -> 'substitutos', '[]'::jsonb)) loop
      v_linha := v_sub -> 'linha';

      select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', '), string_agg(format('%I = r.%I', k, k), ', ')
      into v_cols, v_vals, v_set
      from jsonb_object_keys(v_linha) k
      where k <> all (v_proibidas)
        and k in (select attname from pg_attribute
                  where attrelid = 'public.meal_item_substitutions'::regclass and attnum > 0 and not attisdropped);

      if v_sub ->> 'id' is null then
        execute format(
          'insert into public.meal_item_substitutions (%s, meal_item_id, user_id) select %s, $2, $3 from jsonb_populate_record(null::public.meal_item_substitutions, $1) r',
          v_cols, v_vals)
        using v_linha, v_item_id, v_user;
      else
        execute format(
          'update public.meal_item_substitutions t set %s, meal_item_id = $3 from jsonb_populate_record(null::public.meal_item_substitutions, $1) r '
          'where t.id = $2 and t.meal_item_id in (select i.id from public.meal_items i where i.meal_id = $4)',
          v_set)
        using v_linha, (v_sub ->> 'id')::uuid, v_item_id, p_meal_id;
        get diagnostics v_n = row_count;
        if v_n = 0 then
          raise exception 'Um substituto desta refeição não foi encontrado.';
        end if;
      end if;
    end loop;
  end loop;
end;
$$;

comment on function public.salvar_refeicao(uuid, jsonb, jsonb, uuid[], uuid[]) is
  'Fase 19: grava a refeição inteira (janela "Editar refeição") numa transação só. Security invoker — a RLS vale normalmente.';

revoke all on function public.salvar_refeicao(uuid, jsonb, jsonb, uuid[], uuid[]) from public;
revoke all on function public.salvar_refeicao(uuid, jsonb, jsonb, uuid[], uuid[]) from anon;
grant execute on function public.salvar_refeicao(uuid, jsonb, jsonb, uuid[], uuid[]) to authenticated;
