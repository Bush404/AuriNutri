-- ============================================================================
-- 0029_appointment_financial_status.sql
--
-- Fase 9, Bloco D — Status financeiro no agendamento (Agenda). Ao agendar ou
-- editar uma consulta, o profissional pode marcar: não pago, pagou sinal,
-- pagou integral ou gratuito. O DINHEIRO em si (valores, datas, forma de
-- pagamento) continua vivendo em patient_billings/payments — mesmas tabelas
-- que a aba Financeiro do paciente já usa — pra não duplicar lógica nem
-- desincronizar dos totais de Pendente/Recebido já existentes.
--
-- appointments.status_financeiro existe só por um motivo: "gratuito" e
-- "nunca definido" são os dois únicos casos que NÃO geram nenhuma linha em
-- patient_billings/payments (não dá pra guardar um pagamento de valor R$0 —
-- a constraint valor > 0 já existe desde a migration 0025), então sem esta
-- coluna os dois casos seriam indistinguíveis ao reabrir o agendamento pra
-- editar. Para não_pago/pagou_sinal/pagou_integral, esta coluna é só um
-- espelho de conveniência — o valor de verdade está nos payments ligados via
-- patient_billings.appointment_id.
-- ============================================================================

alter table public.appointments
  add column if not exists status_financeiro text
    check (status_financeiro in ('nao_pago', 'pagou_sinal', 'pagou_integral', 'gratuito'));

comment on column public.appointments.status_financeiro is 'Status financeiro definido ao agendar/editar a consulta. O dinheiro em si (valores/datas/forma de pagamento) fica em patient_billings/payments via appointment_id — esta coluna só existe pra distinguir "gratuito" de "nunca definido" (ambos sem nenhuma linha de payment).';

alter table public.patient_billings
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null;

comment on column public.patient_billings.appointment_id is 'Presente quando esta cobrança nasceu do Status financeiro de um agendamento — nulo para cobranças criadas direto na aba Financeiro do paciente. on delete set null: apagar o agendamento não invalida a cobrança já registrada.';

create index if not exists patient_billings_appointment_id_idx on public.patient_billings (appointment_id) where deleted_at is null;
