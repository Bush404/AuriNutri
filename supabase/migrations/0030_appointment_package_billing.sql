-- ============================================================================
-- 0030_appointment_package_billing.sql
--
-- Fase 9, Bloco E — "Novo pacote" na Agenda: agenda N consultas de uma vez,
-- ligadas a UMA cobrança de pacote (patient_billings.tipo = 'pacote').
--
-- patient_billings.appointment_id (migration 0029) é 1:1 — uma cobrança
-- avulsa criada a partir de UMA consulta específica. Um pacote é o oposto:
-- VÁRIAS consultas compartilham UMA cobrança. Por isso a FK vai no sentido
-- inverso, em appointments (N:1), e não reaproveita appointment_id.
-- ============================================================================

alter table public.appointments
  add column if not exists patient_billing_id uuid references public.patient_billings (id) on delete set null;

comment on column public.appointments.patient_billing_id is 'Presente quando esta consulta faz parte de um pacote criado por "Novo pacote" — aponta pra UMA patient_billings compartilhada por várias consultas (N:1, oposto de patient_billings.appointment_id que é 1:1 e serve só pra consulta avulsa). on delete set null: apagar a cobrança não some com a consulta.';

create index if not exists appointments_patient_billing_id_idx on public.appointments (patient_billing_id) where deleted_at is null;
