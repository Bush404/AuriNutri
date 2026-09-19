-- ============================================================================
-- 0022_patient_photos.sql
--
-- Fase 7, Bloco C — evolução fotográfica. RISCO ALTO: foto corporal de
-- paciente é dado pessoal sensível (LGPD art. 5º, II — biometria). Este
-- bloco só existe sobre a base de consentimento do Bloco A (migration 0019).
--
-- GARANTIA NO BANCO, NÃO SÓ NA APLICAÇÃO: diferente de `lab_exams` (onde o
-- bloqueio de upload sem consentimento é só uma checagem na Server Action),
-- aqui a policy de INSERT chama has_active_patient_consent() diretamente no
-- WITH CHECK — mesmo se a Server Action esquecesse de checar, o Postgres
-- rejeitaria o INSERT. É a interpretação mais forte de "não é um aviso que
-- dá pra ignorar".
--
-- Revogar consentimento DEPOIS de uma foto já existir não apaga a foto
-- (mesma decisão do Bloco A: revogar bloqueia coleta futura, não elimina
-- retroativamente dado já coletado sob consentimento válido) — por isso o
-- SELECT não exige consentimento ativo, só o INSERT.
-- ============================================================================

create table if not exists public.patient_photos (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  data_registro date not null,
  tipo text not null check (tipo in ('frente', 'perfil', 'costas')),
  -- Path no bucket privado SEPARADO 'fotos-evolucao' — nunca uma URL. Vira
  -- NULL quando a foto é excluída (ver soft_delete_patient_photo): a
  -- exclusão remove o arquivo do storage de verdade, não só marca
  -- deleted_at — "direito ao esquecimento" não se satisfaz com soft delete
  -- se o arquivo continua no bucket.
  arquivo_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.patient_photos.arquivo_path is 'Path no bucket privado "fotos-evolucao" (pasta <user_id>/<patient_id>/) — nunca uma URL. NULL após exclusão: o arquivo é removido do storage de verdade, não só soft-deletado.';
comment on column public.patient_photos.tipo is 'frente | perfil | costas — usado para comparar duas datas do MESMO ângulo.';

create index if not exists patient_photos_user_id_idx on public.patient_photos (user_id) where deleted_at is null;
create index if not exists patient_photos_patient_tipo_idx on public.patient_photos (patient_id, tipo) where deleted_at is null;

alter table public.patient_photos enable row level security;

create policy "patient_photos_select_own" on public.patient_photos
  for select using (auth.uid() = user_id and deleted_at is null);

-- A GARANTIA FORTE: o INSERT só é aceito se existir consentimento ATIVO do
-- tipo 'fotos' para o paciente — checado pelo próprio Postgres, não só pela
-- Server Action. has_active_patient_consent é security definer (migration
-- 0019) e já filtra por auth.uid() internamente.
create policy "patient_photos_insert_own" on public.patient_photos
  for insert with check (
    auth.uid() = user_id
    and public.has_active_patient_consent(patient_id, 'fotos')
  );

-- Nenhuma policy de UPDATE para a role authenticated: o único jeito de
-- mudar uma linha depois de criada é soft_delete_patient_photo (abaixo),
-- que roda como security definer. Nenhuma policy de DELETE: a linha nunca
-- é apagada de verdade, só marcada (a exclusão física é do ARQUIVO no
-- storage, feita pela Server Action antes de chamar a função abaixo).

-- ----------------------------------------------------------------------------
-- Soft delete via função security definer — mesmo motivo estrutural das
-- migrations 0017/0020 (a policy de SELECT exige deleted_at is null, e o
-- Postgres rejeita a própria linha virando invisível por ela mesma durante
-- um UPDATE direto). Também limpa arquivo_path: a Server Action chama esta
-- função SÓ DEPOIS de confirmar que o arquivo foi removido do storage.
-- ----------------------------------------------------------------------------
create or replace function public.soft_delete_patient_photo(photo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.patient_photos
  set deleted_at = now(),
      arquivo_path = null
  where id = photo_id
    and user_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.soft_delete_patient_photo(uuid) from public;
grant execute on function public.soft_delete_patient_photo(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Trilha de acesso: quem visualizou qual foto e quando (item 7 do Bloco C).
-- Reaproveita audit_log (migration 0005), que até aqui só tinha
-- insert/update/delete — precisa aceitar 'view', um evento de LEITURA, não
-- de escrita. audit_log normalmente só é gravado pelo trigger
-- log_audit_event (mudanças em linha); aqui não há linha mudando quando
-- alguém só OLHA uma foto, então log_photo_view grava diretamente, mesmo
-- padrão de "só security definer escreve em audit_log" — nunca a Server
-- Action insere direto (não há policy de insert pra authenticated).
-- ----------------------------------------------------------------------------
do $$
declare
  check_name text;
begin
  select conname into check_name
  from pg_constraint
  where conrelid = 'public.audit_log'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%acao%';

  if check_name is not null then
    execute format('alter table public.audit_log drop constraint %I', check_name);
  end if;
end $$;

alter table public.audit_log
  add constraint audit_log_acao_check
  check (acao in ('insert', 'update', 'delete', 'view'));

create or replace function public.log_photo_view(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from public.patient_photos
  where id = p_photo_id;

  -- Só registra se quem está chamando é o dono da foto — nunca revela nem
  -- registra nada sobre uma foto de outro profissional.
  if v_owner is null or v_owner <> auth.uid() then
    return;
  end if;

  insert into public.audit_log (tabela, registro_id, acao, user_id)
  values ('patient_photos', p_photo_id, 'view', auth.uid());
end;
$$;

revoke all on function public.log_photo_view(uuid) from public;
grant execute on function public.log_photo_view(uuid) to authenticated;
