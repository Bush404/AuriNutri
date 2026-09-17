-- ============================================================================
-- 0012_appointments_no_overlap.sql
--
-- Fase 5, correção pós-uso — impede dois agendamentos sobrepostos para o
-- mesmo profissional. Antes disso, nada bloqueava marcar dois pacientes no
-- mesmo horário.
--
-- DECISÃO DE ARQUITETURA: a garantia vai para o banco via EXCLUDE constraint
-- (GiST), não só para uma checagem no código — mesmo racional já usado para
-- soft delete (migration 0005): "a garantia está no banco, não na
-- disciplina da aplicação". Cobre inclusive corrida de requisições
-- concorrentes, que uma checagem em duas queries separadas na Server Action
-- não cobriria sozinha.
--
-- TENTATIVAS ANTERIORES (documentando o porquê, não é dívida técnica):
--   1ª: `tstzrange(data_hora, data_hora + (duracao_min || ' minutes')::interval)`
--       — falhou: `timestamptz + interval` é STABLE no Postgres (o resultado
--       pode variar com o fuso da sessão ao somar dias/meses), e índices
--       GiST exigem expressões IMMUTABLE.
--   2ª: `numrange(extract(epoch from data_hora)::numeric, ...)` — também
--       falhou: `extract()`/`date_part()` sobre timestamptz é STABLE como
--       função inteira (outros campos como 'hour'/'day' dependem do fuso da
--       sessão), mesmo o campo 'epoch' específico não dependendo na prática.
--   Solução: gravar o instante de término (`data_fim`) como uma coluna
--   comum, calculada pela APLICAÇÃO (TypeScript) no insert/update — não por
--   uma expressão SQL. `tstzrange(data_hora, data_fim)` sobre duas colunas
--   simples não envolve nenhuma função de data, e é sempre IMMUTABLE.
-- ============================================================================

create extension if not exists btree_gist;

alter table public.appointments add column if not exists data_fim timestamptz;

update public.appointments
  set data_fim = data_hora + (duracao_min || ' minutes')::interval
  where data_fim is null;

alter table public.appointments alter column data_fim set not null;

comment on column public.appointments.data_fim is 'Instante de término (data_hora + duracao_min), gravado explicitamente pela aplicação a cada insert/update — existe para viabilizar a exclusion constraint abaixo sem aritmética de data dentro do índice.';

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    user_id with =,
    tstzrange(data_hora, data_fim) with &&
  )
  where (deleted_at is null and status <> 'cancelado');

comment on constraint appointments_no_overlap on public.appointments is
  'Impede dois agendamentos sobrepostos do mesmo profissional (exclui cancelados/excluídos). Garantia no banco, não só na aplicação.';
