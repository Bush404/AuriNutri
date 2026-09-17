-- ============================================================================
-- AuriNutri - Migration 0006
-- Fase 3, Bloco B — anamnesis deixa de ser 1:1 com o paciente (sobrescrita a
-- cada edição) e passa a ser 1:N (histórico de registros, nunca sobrescrito).
--
-- GARANTIA CONTRA PERDA DE DADOS:
--   - Nenhuma linha é apagada ou reescrita nesta migration. As únicas
--     operações são: adicionar uma coluna nova (`data_registro`), preencher
--     essa coluna nas linhas já existentes a partir de `created_at` (que já
--     existe e nunca muda), e remover uma constraint de unicidade — nenhuma
--     dessas operações toca no conteúdo das colunas já existentes
--     (queixa_principal, historico_saude, etc.).
--   - Toda anamnese hoje existente continua existindo depois, com o mesmo
--     `id`, e passa a ser automaticamente o "primeiro registro" daquele
--     paciente no histórico — não precisa de nenhum passo extra pra isso,
--     é conseqüência direta de nenhuma linha ser removida.
--   - A constraint UNIQUE é localizada dinamicamente por introspecção do
--     catálogo (pg_constraint), não pelo nome assumido — evita o risco de
--     um DROP CONSTRAINT IF EXISTS silenciosamente não fazer nada porque o
--     nome real é diferente do esperado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DATA_REGISTRO — backfill a partir de created_at (data real do registro
--    histórico), não da data de hoje, antes de tornar a coluna NOT NULL.
-- ----------------------------------------------------------------------------
alter table public.anamnesis add column if not exists data_registro date;

update public.anamnesis
set data_registro = created_at::date
where data_registro is null;

alter table public.anamnesis alter column data_registro set default current_date;
alter table public.anamnesis alter column data_registro set not null;

comment on column public.anamnesis.data_registro is 'Data do registro clínico. anamnesis é 1:N por paciente (histórico) — cada registro tem a sua.';

-- ----------------------------------------------------------------------------
-- 2. Remove a constraint UNIQUE de patient_id (1:1 -> 1:N).
--    Localiza a constraint por introspecção em vez de assumir o nome, para
--    garantir que ela realmente seja removida.
-- ----------------------------------------------------------------------------
do $$
declare
  uc record;
begin
  for uc in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'anamnesis'
      and con.contype = 'u'
      and con.conkey = array(
        select attnum from pg_attribute
        where attrelid = rel.oid and attname = 'patient_id'
      )
  loop
    execute format('alter table public.anamnesis drop constraint %I', uc.conname);
    raise notice 'Constraint UNIQUE removida: %', uc.conname;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Índice para a linha do tempo (mais recente primeiro por paciente).
--    Substitui o índice simples de patient_id por um composto — a
--    constraint UNIQUE removida acima já tinha seu próprio índice implícito,
--    que é removido automaticamente junto com ela.
-- ----------------------------------------------------------------------------
drop index if exists public.anamnesis_patient_id_idx;
create index anamnesis_patient_id_idx
  on public.anamnesis (patient_id, data_registro desc)
  where deleted_at is null;
