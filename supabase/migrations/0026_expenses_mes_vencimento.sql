-- ============================================================================
-- 0026_expenses_mes_vencimento.sql
--
-- Fase 9, Bloco B — correção pós-uso: despesa trimestral/semestral/anual só
-- guardava o DIA do vencimento, sem mês — "próximo vencimento" tinha que
-- adivinhar o mês a partir de created_at, o que não reflete o mês real
-- combinado pelo profissional (ex.: uma despesa trimestral pode vencer em
-- jan/abr/jul/out OU em fev/mai/ago/nov — não dá pra saber só pelo dia).
--
-- Adiciona mes_vencimento (1-12), obrigatório para trimestral/semestral/anual
-- e sempre nulo para 'unica'/'mensal' (mensal recorre todo mês, não precisa
-- de mês fixo). A troca de constraint substitui inteiramente a
-- expenses_vencimento_check original da migration 0025.
-- ============================================================================

alter table public.expenses
  add column if not exists mes_vencimento integer check (mes_vencimento between 1 and 12);

comment on column public.expenses.mes_vencimento is 'Mês (1-12) do primeiro vencimento do ciclo — obrigatório para trimestral/semestral/anual, sempre nulo para unica/mensal. Junto com dia_vencimento, define os meses fixos de recorrência (ex.: mês 3 + trimestral = vence em mar/jun/set/dez).';

-- Preenche despesas trimestrais/semestrais/anuais já cadastradas antes desta coluna existir,
-- usando o mês de criação como aproximação — só assim a constraint nova abaixo não quebra em
-- cima de dado já existente. Novas despesas passam a guardar o mês real escolhido na tela.
update public.expenses
set mes_vencimento = extract(month from created_at)::integer
where recorrencia in ('trimestral', 'semestral', 'anual') and mes_vencimento is null;

alter table public.expenses drop constraint if exists expenses_vencimento_check;

alter table public.expenses add constraint expenses_vencimento_check check (
  (recorrencia = 'unica' and dia_vencimento is null and mes_vencimento is null and data_vencimento is not null)
  or (recorrencia = 'mensal' and dia_vencimento is not null and mes_vencimento is null and data_vencimento is null)
  or (recorrencia in ('trimestral', 'semestral', 'anual') and dia_vencimento is not null and mes_vencimento is not null and data_vencimento is null)
);
