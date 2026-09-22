-- 0036 — Excluir a conta apaga também o histórico de auditoria dela.
--
-- Decisão do usuário (2026-09-22): se uma conta é excluída, nada dela deve
-- ficar guardado. Até aqui, audit_log.user_id era "on delete set null": as
-- linhas sobreviviam à exclusão da conta, com dados_anteriores/dados_novos
-- guardando cópias completas de registros de pacientes.
--
-- Agora é "on delete cascade", como todas as outras tabelas com user_id.
-- Complementa a 0035 (que impede o gatilho de gravar eventos novos durante a
-- exclusão). Os arquivos no Storage não são apagados pelo banco — ver
-- scripts/delete-account.mjs, o procedimento completo de exclusão de conta.
--
-- Linhas antigas que já estão com user_id nulo (de contas excluídas antes
-- desta migration) são apagadas aqui também, pela mesma decisão.

alter table public.audit_log drop constraint if exists audit_log_user_id_fkey;
alter table public.audit_log
  add constraint audit_log_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

delete from public.audit_log where user_id is null;
