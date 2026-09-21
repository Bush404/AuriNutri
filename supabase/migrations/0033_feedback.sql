-- ============================================================================
-- 0033_feedback.sql
--
-- Canal de feedback direto (nutricionista -> desenvolvedor), construído no
-- lugar da comunidade da Fase 10 (que continua adiada, dependente de base de
-- usuários ativa) — preparação para os primeiros usuários reais.
--
-- Sem policy de admin/leitura por terceiros de propósito: a leitura é feita
-- pelo painel do Supabase (service role, ignora RLS) por enquanto. Não
-- introduzimos o primeiro usuário privilegiado do sistema por conveniência —
-- mesma cautela já registrada no projeto sobre multi-tenancy/papéis.
-- ============================================================================

create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('sugestao', 'problema', 'elogio', 'outro')),
  mensagem text not null,
  -- Contexto capturado automaticamente (nunca digitado pelo usuário) — é o
  -- que torna o feedback acionável: "sugestão na tela de plano alimentar" em
  -- vez de "sugestão" solta.
  rota text,
  user_agent text,
  viewport text,
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.feedback is 'Canal de feedback direto dos profissionais, identificado (não anônimo). Lido via painel do Supabase — sem policy de admin nesta fase.';
comment on column public.feedback.rota is 'Pathname da tela em que o usuário estava ao abrir o formulário (usePathname) — capturado automaticamente.';
comment on column public.feedback.user_agent is 'navigator.userAgent no momento do envio — só para diagnóstico de bug, nunca exibido a outro usuário.';
comment on column public.feedback.viewport is 'Tamanho da janela ("larguraxaltura") no momento do envio — só para diagnóstico de bug.';
comment on column public.feedback.lido is 'Marcado manualmente pelo painel do Supabase — sem fluxo de UI nem policy de update nesta fase.';

create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);

create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = user_id);
