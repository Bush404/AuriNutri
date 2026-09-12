-- 0003_search_indexes.sql
--
-- As buscas de pacientes e alimentos usam `ilike('%termo%')`, que não consegue
-- usar o índice GIN de full-text (`to_tsvector`) criado em 0001_init.sql — esse
-- índice serve para busca por palavras completas, não por substring no meio do
-- texto. Resultado: hoje a busca faz um scan sequencial em `patients` e `foods`
-- a cada tecla digitada.
--
-- pg_trgm indexa trigramas (sequências de 3 caracteres), que é o que o operador
-- `ilike`/`like` com `%...%` de fato usa para casar substring.

create extension if not exists pg_trgm;

create index if not exists patients_nome_trgm_idx
  on public.patients using gin (nome gin_trgm_ops);

create index if not exists foods_nome_trgm_idx
  on public.foods using gin (nome gin_trgm_ops);
