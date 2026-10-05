-- ============================================================================
-- 0051 — Fase 19 (Roadmap 2): limpa as cobranças "fantasmas" (05/10/2026).
--
-- Até hoje, excluir uma cobrança pendente na aba Financeiro do paciente
-- apagava só o PAGAMENTO (soft_delete_payment) e deixava o registro da
-- cobrança (patient_billings) sem nenhum pagamento. A partir desta entrega,
-- deletePayment (src/lib/actions/finance.ts) exclui a cobrança junto quando
-- apaga o último pagamento dela. Esta migration faz o mesmo com as que já
-- ficaram para trás.
--
-- Cobrança sem pagamento nunca é legítima: toda cobrança nasce com pelo menos
-- um pagamento, e "gratuito" (agenda) não cria cobrança nenhuma. O próprio
-- código já apaga a cobrança em todos os outros caminhos que a deixariam vazia.
--
-- É o mesmo soft delete de sempre (deleted_at), nada é apagado de verdade.
-- Roda como dono do banco no SQL Editor (por isso o update direto, sem a
-- função soft_delete_patient_billing, que confere auth.uid()).
--
-- Para ver ANTES quantas são (opcional):
--   select count(*) from public.patient_billings b
--   where b.deleted_at is null
--     and not exists (select 1 from public.payments p where p.billing_id = b.id and p.deleted_at is null);
-- ============================================================================

update public.patient_billings b
set deleted_at = now()
where b.deleted_at is null
  and not exists (
    select 1
    from public.payments p
    where p.billing_id = b.id
      and p.deleted_at is null
  );
