-- ============================================================================
-- 0052 — Fase 19 (Roadmap 2): "Salvar alterações" da janela dos marcadores
-- grava tudo numa transação só — ou tudo, ou nada (pedido de 05/10/2026, como
-- a janela da refeição na 0049).
--
-- Antes, cada marcador era gravado no clique em "Adicionar marcador" e
-- removido na hora. Agora a janela monta um rascunho (novos + removidos) e a
-- ação salvarMarcadores (src/lib/actions/lab-markers.ts) chama esta função uma
-- vez. Se qualquer passo falhar, o Postgres desfaz os anteriores e o exame
-- continua exatamente como estava.
--
-- SECURITY INVOKER (o padrão): roda com as permissões de quem está logado, e
-- as políticas de RLS de lab_exams e lab_markers valem como em qualquer outra
-- gravação. A mais: confere que o EXAME é do profissional (a política de
-- INSERT de lab_markers só olha user_id, não o dono do exame).
--
-- fora_da_faixa continua calculado pelo próprio banco (coluna gerada).
-- Só cria uma função: seguro de aplicar com o site no ar, nenhum dado muda.
-- ============================================================================

create or replace function public.salvar_marcadores(
  p_exam_id uuid,
  -- [{"nome_marcador": "...", "valor": 180, "unidade": "mg/dL",
  --   "referencia_min": null | 0, "referencia_max": null | 190, "referencia_editada": false}]
  p_novos jsonb,
  p_removidos uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_n integer;
begin
  if v_user is null then
    raise exception 'Sessão expirada. Faça login novamente.';
  end if;

  -- O exame tem de ser do profissional (a RLS de lab_exams só mostra os dele, e não os excluídos).
  if not exists (select 1 from public.lab_exams e where e.id = p_exam_id and e.user_id = v_user) then
    raise exception 'Exame não encontrado.';
  end if;

  -- 1. Marcadores tirados (só os desta coleta; exclusão real, como sempre foi).
  if coalesce(array_length(p_removidos, 1), 0) > 0 then
    delete from public.lab_markers m
    where m.id = any (p_removidos)
      and m.exam_id = p_exam_id;
    get diagnostics v_n = row_count;
    if v_n <> array_length(p_removidos, 1) then
      raise exception 'Um marcador desta coleta não foi encontrado.';
    end if;
  end if;

  -- 2. Marcadores novos.
  insert into public.lab_markers (exam_id, user_id, nome_marcador, valor, unidade, referencia_min, referencia_max, referencia_editada)
  select p_exam_id, v_user, trim(x.nome_marcador), x.valor, trim(x.unidade), x.referencia_min, x.referencia_max, coalesce(x.referencia_editada, false)
  from jsonb_to_recordset(coalesce(p_novos, '[]'::jsonb))
    as x(nome_marcador text, valor numeric, unidade text, referencia_min numeric, referencia_max numeric, referencia_editada boolean);
end;
$$;

comment on function public.salvar_marcadores(uuid, jsonb, uuid[]) is
  'Fase 19: grava os marcadores de uma coleta (janela "Marcadores") numa transação só. Security invoker — a RLS vale normalmente.';

revoke all on function public.salvar_marcadores(uuid, jsonb, uuid[]) from public;
revoke all on function public.salvar_marcadores(uuid, jsonb, uuid[]) from anon;
grant execute on function public.salvar_marcadores(uuid, jsonb, uuid[]) to authenticated;
