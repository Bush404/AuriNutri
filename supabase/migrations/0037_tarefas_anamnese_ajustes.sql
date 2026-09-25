-- ============================================================================
-- 0037 — Fase 13 (Roadmap 2): ajustes rápidos do dia a dia.
--
-- Só acrescenta. Nenhuma linha existente é alterada ou apagada, e nenhuma
-- coluna existente muda: seguro de aplicar com o site antigo no ar.
--
-- 1. tasks.horario — horário OPCIONAL da tarefa. É horário de parede no fuso
--    do profissional (profiles.fuso_horario), igual ao que ele digita; não é
--    um instante UTC. Tarefa continua sem duração e fora da trava de horário
--    sobreposto das consultas (migration 0012 vale só para appointments).
-- 2. anamnesis.titulo — nome OPCIONAL do registro ("Anamnese inicial",
--    "Retorno 3 meses"...), mostrado na lista fechada da aba Anamnese.
--    Registros antigos ficam sem nome e a tela mostra "Registro de anamnese".
-- 3. soft_delete_anamnesis — exclusão lógica pelo padrão obrigatório da
--    migration 0017 (security definer + checagem de posse no WHERE). O
--    registro fica no banco com deleted_at preenchido e continua no
--    audit_log; só some da tela (policy de select da migration 0005).
-- ============================================================================

alter table public.tasks add column if not exists horario time;
comment on column public.tasks.horario is 'Horário opcional, de parede, no fuso de profiles.fuso_horario (não é instante UTC).';

alter table public.anamnesis add column if not exists titulo text;
comment on column public.anamnesis.titulo is 'Nome opcional do registro, exibido na lista da aba Anamnese.';

create or replace function public.soft_delete_anamnesis(anamnesis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.anamnesis
  set deleted_at = now()
  where id = anamnesis_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_anamnesis(uuid) from public;
grant execute on function public.soft_delete_anamnesis(uuid) to authenticated;
