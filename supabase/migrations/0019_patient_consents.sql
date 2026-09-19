-- ============================================================================
-- 0019_patient_consents.sql
--
-- Fase 7, Bloco A — base de consentimento. Antes de qualquer funcionalidade
-- que armazene dado sensível de paciente (exame, foto — LGPD art. 5º, II:
-- dado de saúde e biometria), precisa existir consentimento registrado.
-- NENHUM upload nesta migration — só a tabela, o registro/revogação e a
-- checagem que os blocos seguintes (exames, fotos) vão consultar antes de
-- sequer mostrar a opção de enviar um arquivo.
--
-- CADA LINHA É UM EVENTO DE CONSENTIMENTO, NUNCA EDITADO DEPOIS DE CRIADO —
-- mesmo espírito de audit_log (migration 0005): revogar não apaga nem
-- reescreve o registro original, só marca `data_revogacao`/`concedido`
-- nesse mesmo evento. Conceder de novo depois de revogado cria uma NOVA
-- linha (um novo evento), preservando a linha do tempo completa de
-- concessões e revogações — é a trilha que demonstra, se preciso, que o
-- consentimento foi pedido e documentado.
--
-- REVOGAÇÃO (decisão registrada com o usuário, 2026-09-19): revogar
-- bloqueia CONSENTIMENTO ATIVO daquele tipo a partir de agora (estrutural,
-- via has_active_patient_consent() nos blocos seguintes) — nunca apaga
-- arquivo/dado já existente automaticamente. Exclusão do que já existe,
-- se pedida pelo paciente, é uma ação separada e explícita a ser feita
-- depois, não um efeito colateral automático de revogar.
--
-- GRANTS DE COLUNA: a role `authenticated` só pode fazer UPDATE nas colunas
-- `concedido`/`data_revogacao` — o resto do registro (tipo, forma, data de
-- concessão, observações) é imutável depois de criado, mesmo para o
-- profissional dono da linha. A garantia de "não adulterar o histórico de
-- consentimento" mora no banco, não na disciplina da aplicação.
-- ============================================================================

create table if not exists public.patient_consents (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('exames', 'fotos', 'dados_clinicos')),
  concedido boolean not null default true,
  data_consentimento timestamptz not null default now(),
  data_revogacao timestamptz,
  forma text not null check (forma in ('presencial', 'documento_assinado', 'verbal_registrado')),
  observacoes text,
  created_at timestamptz not null default now(),
  check (data_revogacao is null or data_revogacao >= data_consentimento)
);

comment on table public.patient_consents is 'Registro de consentimento do paciente para tratamento de dado sensível (LGPD art. 5º, II). Cada linha é um evento imutável — revogar não apaga, só marca data_revogacao nesse mesmo evento (ver comentário no topo da migration 0019).';
comment on column public.patient_consents.tipo is 'exames | fotos | dados_clinicos — o tipo de dado sensível a que este consentimento se refere.';
comment on column public.patient_consents.concedido is 'true enquanto o consentimento está ativo; revogar seta para false neste mesmo registro (não cria exclusão nem edição do histórico).';
comment on column public.patient_consents.forma is 'Como o consentimento foi obtido: presencial | documento_assinado | verbal_registrado.';

create index if not exists patient_consents_user_id_idx on public.patient_consents (user_id);
create index if not exists patient_consents_patient_id_idx on public.patient_consents (patient_id);
create index if not exists patient_consents_ativo_idx on public.patient_consents (patient_id, tipo) where concedido = true and data_revogacao is null;

alter table public.patient_consents enable row level security;

create policy "patient_consents_select_own" on public.patient_consents
  for select using (auth.uid() = user_id);
create policy "patient_consents_insert_own" on public.patient_consents
  for insert with check (auth.uid() = user_id);
create policy "patient_consents_update_own" on public.patient_consents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nenhuma policy de DELETE — um consentimento (concedido ou revogado) nunca
-- é apagado, só o próprio Postgres (superuser/service role) poderia, fora
-- da aplicação. Trilha de consentimento é permanente por design.

-- Coluna-a-coluna: só concedido/data_revogacao são editáveis pela role
-- authenticated depois da criação — tipo/forma/observacoes/data_consentimento
-- ficam congelados no momento do INSERT.
revoke update on public.patient_consents from authenticated;
grant update (concedido, data_revogacao) on public.patient_consents to authenticated;

-- ----------------------------------------------------------------------------
-- Checagem reutilizável pelos blocos seguintes (exames, fotos): existe
-- consentimento ATIVO desse tipo para este paciente? security definer para
-- poder ser chamada de qualquer contexto autenticado sem depender de uma
-- policy de SELECT adicional — mas ainda assim só responde sobre pacientes
-- do PRÓPRIO usuário (auth.uid() = user_id no WHERE), nunca vaza dado de
-- outro profissional.
-- ----------------------------------------------------------------------------
create or replace function public.has_active_patient_consent(p_patient_id uuid, p_tipo text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.patient_consents
    where patient_id = p_patient_id
      and user_id = auth.uid()
      and tipo = p_tipo
      and concedido = true
      and data_revogacao is null
  );
$$;

revoke all on function public.has_active_patient_consent(uuid, text) from public;
grant execute on function public.has_active_patient_consent(uuid, text) to authenticated;
