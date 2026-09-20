-- ============================================================================
-- 0028_document_share_recibo.sql
--
-- Fase 9, Bloco C — recibo de pagamento vira mais um tipo de documento da
-- Central de Envio, reaproveitando document_share_tokens/get_shared_document
-- (migration 0024) — sem tabela, bucket ou função nova.
--
-- Nome explícito igual ao que o Postgres já usa sozinho para o CHECK inline
-- original da coluna `tipo` ("<tabela>_<coluna>_check") — sem introduzir uma
-- segunda constraint com nome parecido, então não repete o bug da migration
-- 0025 (nomes colidindo).
-- ============================================================================

alter table public.document_share_tokens drop constraint if exists document_share_tokens_tipo_check;

alter table public.document_share_tokens add constraint document_share_tokens_tipo_check
  check (tipo in ('antropometria', 'receita', 'arquivo', 'recibo'));
