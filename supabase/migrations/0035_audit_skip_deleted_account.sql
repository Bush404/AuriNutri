-- 0035 — Exclusão de conta com pacientes deixava de funcionar por causa da auditoria.
--
-- Problema (encontrado pela limpeza dos testes E2E, Fase 11 Bloco C): ao apagar
-- um usuário em auth.users, a cascata apaga os pacientes (e anamneses,
-- avaliações, planos...). Cada DELETE dispara log_audit_event(), que grava em
-- audit_log com user_id = dono do registro — justamente o usuário que está
-- sendo apagado. A FK audit_log.user_id -> auth.users recusa, e a exclusão da
-- conta inteira falha ("Database error deleting user").
--
-- Correção: se o autor já não existe em auth.users (a conta está sendo
-- excluída), não grava o evento. Não faz sentido auditar a remoção em cascata
-- da própria conta, e gravar criaria cópias órfãs (dados_anteriores) dos dados
-- de pacientes de uma conta excluída. Todo o resto do comportamento é idêntico
-- ao da 0005.

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  acao text;
  actor_id uuid;
  registro uuid;
  old_json jsonb;
  new_json jsonb;
begin
  old_json := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  new_json := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;

  acao := lower(TG_OP);

  if TG_OP = 'UPDATE'
     and old_json ? 'deleted_at'
     and old_json ->> 'deleted_at' is null
     and new_json ->> 'deleted_at' is not null then
    acao := 'delete';
  end if;

  if TG_OP = 'DELETE' then
    registro := OLD.id;
  else
    registro := NEW.id;
  end if;

  actor_id := coalesce(auth.uid(), case when TG_OP = 'DELETE' then OLD.user_id else NEW.user_id end);

  -- Conta sendo excluída (cascata a partir de auth.users): não audita.
  if actor_id is not null and not exists (select 1 from auth.users where id = actor_id) then
    return coalesce(NEW, OLD);
  end if;

  insert into public.audit_log (tabela, registro_id, acao, user_id, dados_anteriores, dados_novos)
  values (TG_TABLE_NAME, registro, acao, actor_id, old_json, new_json);

  return coalesce(NEW, OLD);
end;
$$;
