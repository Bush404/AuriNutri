-- ============================================================================
-- 0034_rate_limiting.sql
--
-- Fase 11, Bloco A — rate limiting nas operações caras (gerar PDF/link de
-- compartilhamento, enviar arquivo). Decisão registrada com o usuário antes
-- de implementar: guardar o contador no Postgres (mesma infra de sempre,
-- zero serviço/dependência nova), não num serviço externo tipo Redis —
-- viável porque são operações caras e por natureza raras, não um endpoint de
-- alta frequência. Se um dia isso precisar mudar, esta tabela é só um
-- "bloco de rascunho": não guarda dado de paciente nem nada do negócio, dá
-- pra trocar de abordagem sem perder nada de verdade.
--
-- Netlify Functions são serverless (sem estado em memória entre invocações),
-- então um contador em variável de módulo não funcionaria — precisa de um
-- lugar compartilhado de verdade. O INSERT ... ON CONFLICT abaixo é atômico
-- no Postgres, então funciona mesmo com várias funções rodando ao mesmo
-- tempo sem se falarem.
--
-- Janela FIXA (não deslizante): cada contagem pertence a um bloco de tempo
-- de largura `p_window_seconds` a partir da época Unix — mais simples que
-- janela deslizante, suficiente pra conter abuso (o pior caso é o limite
-- "resetar" um pouco antes da janela cheia passar, não um risco real aqui).
-- ============================================================================

create table public.rate_limit_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  acao text not null,
  janela_inicio timestamptz not null,
  contagem integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, acao, janela_inicio)
);

comment on table public.rate_limit_counters is 'Contador de rate limiting (Fase 11) — só bookkeeping técnico, sem dado de paciente ou de negócio. Escrito exclusivamente pela função check_rate_limit (security definer); nenhuma policy de INSERT/UPDATE/DELETE para a role authenticated.';

alter table public.rate_limit_counters enable row level security;

-- Sem policy de select/insert/update/delete para `authenticated` — só a
-- função abaixo (security definer) toca nesta tabela. O usuário nunca lê
-- nem escreve a própria contagem diretamente.

create or replace function public.check_rate_limit(p_acao text, p_max_tentativas integer, p_janela_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_janela_inicio timestamptz;
  v_contagem integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Bucket de tempo fixo: trunca a época Unix atual pro múltiplo de
  -- p_janela_segundos mais próximo, pra baixo.
  v_janela_inicio := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);

  insert into public.rate_limit_counters (user_id, acao, janela_inicio, contagem)
  values (auth.uid(), p_acao, v_janela_inicio, 1)
  on conflict (user_id, acao, janela_inicio)
  do update set contagem = rate_limit_counters.contagem + 1, updated_at = now()
  returning contagem into v_contagem;

  return v_contagem <= p_max_tentativas;
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is 'Incrementa (ou cria) o contador da janela atual para auth.uid()+ação e retorna true se ainda está dentro do limite, false se estourou. Nunca recebe user_id do chamador — sempre auth.uid() internamente, pra um usuário nunca poder checar/incrementar em nome de outro.';

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

-- Limpeza: linhas de janelas antigas não têm valor nenhum depois de
-- passarem. Sem job agendado neste projeto (mesmo padrão já usado pra
-- expense_occurrences) — a tabela fica pequena por natureza (uma linha por
-- usuário+ação+janela) e pode ser limpa manualmente de vez em quando; não é
-- dado que precise de retenção.
create index rate_limit_counters_janela_idx on public.rate_limit_counters (janela_inicio);
