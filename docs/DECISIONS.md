# DECISIONS — AuriNutri

Decisões arquiteturais registradas conforme exigido pela Fase 1 do `MASTER_DEVELOPMENT_PLAN.md`
(seção "Decisões pendentes", D1 e D2). Devem ser revisitadas apenas com justificativa equivalente
— o custo de mudar de ideia depois cresce a cada fase construída em cima delas.

---

## D1 — Modelo de conta: individual, não clínica/equipe

**Decisão:** cada nutricionista tem sua própria conta isolada. Não há conceito de clínica,
consultório com múltiplos profissionais, ou papéis/permissões dentro de uma mesma conta.

**Data:** 2026-09-12

**Justificativa (do responsável pelo produto):** o foco inicial é construir um software excelente
para o nutricionista individual antes de resolver a complexidade de equipes. Multi-tenancy pode
ser adicionado depois, mas não deve atrasar ou complicar o que já está em construção agora.

**Impacto técnico:**
- O modelo de RLS atual (`auth.uid() = user_id` em cada tabela) permanece correto e não muda.
- Nenhuma tabela de `clinics`/`teams`/`memberships` é necessária na Fase 1-4.
- Se o modelo de clínica for adicionado no futuro (Fase 5+, ver `MASTER_DEVELOPMENT_PLAN.md`),
  será uma migração de dados real (dados hoje presos a `user_id` precisarão ser reatribuídos a uma
  entidade de clínica) — não um simples ajuste de schema. Aceito como custo futuro.

---

## D2 — Paciente não é usuário autenticado

**Decisão:** o paciente não faz login no sistema. É um registro mantido pelo nutricionista,
sem conta, sem senha, sem acesso direto a nenhuma tela do AuriNutri.

**Data:** 2026-09-12

**Justificativa (do responsável pelo produto):** mesmo racional do D1 — construir primeiro a
melhor experiência possível para o profissional. Uma área do paciente introduz uma segunda
superfície de autenticação/autorização (login próprio, RLS separada, risco de vazamento de dado
clínico entre pacientes) que não é prioridade agora.

**Impacto técnico:**
- Nenhuma tabela `patient_users` ou fluxo de convite/login de paciente é necessário.
- Entrega de plano alimentar ao paciente continua sendo feita fora do sistema (PDF, WhatsApp,
  impresso) — não por um portal que o paciente acessa logado.
- A Fase 8 do plano ("Área do paciente") permanece fora de escopo até uma reavaliação futura.

---

## D3 — Tipos gerados existem, mas o generic `Database` continua fora dos clients

**Decisão:** os tipos reais do banco foram gerados (`src/lib/types/database.generated.ts`,
via `supabase gen types typescript`) e a interface `Database` escrita à mão foi removida de
`src/lib/types/database.types.ts`. Porém o generic `Database` **não foi** religado nos três
clients Supabase (`client.ts`, `server.ts`, `middleware.ts`) — eles continuam sem tipo, como
já eram antes.

**Data:** 2026-09-12

**Motivo (achado técnico, não decisão de produto):** ao testar o generic com os tipos gerados
de verdade, `npm run build` voltou a falhar — mas desta vez em `.insert()`/`.update()` (13
ocorrências em `src/lib/actions/*.ts`), com o mesmo sintoma já documentado no `CLAUDE.md` para
`select()`: o argumento é inferido como `never`. A causa provável é a versão instalada de
`@supabase/supabase-js` (`2.45.4`) não reconhecer o campo `__InternalSupabase.PostgrestVersion`
que o gerador de tipos mais recente inclui — esse campo existe justamente para resolver esse
tipo de inferência, e versões mais novas do SDK (a mais recente é `2.116.0` no momento desta
checagem) provavelmente corrigem isso.

**Por que não simplesmente atualizar o SDK agora:** `@supabase/ssr` teve mudanças de API entre
a versão instalada (`0.5.1`) e a mais recente (`0.12.x`) — incluindo a forma como os cookies de
sessão são lidos/escritos. Atualizar os dois pacotes exigiria revisar e testar manualmente todo
o fluxo de autenticação (login, logout, refresh de sessão, proteção de rota no middleware), o
que é um escopo maior do que "gerar tipos" e está fora do que foi pedido nesta etapa.

**Estado atual:** `database.generated.ts` já existe no repositório e pode ser usado para tipar
manualmente uma query específica quando fizer sentido, mesmo sem o generic global. Os tipos de
domínio (`Patient`, `Food`, `MealPlan`...) continuam sendo a forma principal de tipar os
resultados das queries via `.returns<T>()`/`.single<T>()`, como já documentado no `CLAUDE.md`.

**Para revisitar:** atualizar `@supabase/supabase-js` e `@supabase/ssr` juntos, num pull request
dedicado, testando manualmente login/logout/refresh de sessão antes de religar o generic.

---

## D5 — Excluir paciente é definitivo; exclusões pontuais são reversíveis (soft delete)

**Decisão:** ao excluir um **paciente**, tudo relacionado a ele (anamnese, avaliações
antropométricas, planos alimentares, refeições e itens) é apagado de verdade do banco, em
cascata — igual já era antes da Fase 3. Não existe "lixeira" nem forma de desfazer pela
aplicação; a única recuperação possível é via backup manual (`npm run backup:db`).

Já exclusões **pontuais dentro de um paciente que continua ativo** — remover uma avaliação
antropométrica, um plano alimentar, uma refeição ou um item de refeição — usam **soft delete**:
a linha ganha `deleted_at` e fica invisível via RLS, mas não é apagada fisicamente.

**Data:** 2026-09-16

**Justificativa (do responsável pelo produto):** "não tem porque salvar" os dados de um
paciente que foi de fato excluído — soft delete existe pra evitar perder trabalho por um clique
errado num registro específico, não pra reter dado clínico de alguém que o profissional decidiu
remover do consultório.

**Impacto técnico:**
- `patients` **não** recebe a coluna `deleted_at` — as outras 6 tabelas (`anamnesis`,
  `anthropometric_assessments`, `meal_plans`, `meals`, `meal_items`, e `foods` por consistência
  de schema, embora não usada lá) recebem, na migration `0005_soft_delete_audit.sql`.
- `deletePatient` (`src/lib/actions/patients.ts`) continua fazendo `.delete()` real; as demais
  actions de exclusão (`deleteAssessment`, `deleteMealPlan`, `deleteMeal`, `deleteMealItem`)
  passaram a fazer `.update({ deleted_at: now() })`.
- A trigger de auditoria (`log_audit_event`) é genérica o bastante para rodar tanto em
  `patients` (sem `deleted_at`) quanto nas tabelas com soft delete — usa uma checagem via jsonb
  em vez de acessar a coluna diretamente, então não quebra em `patients`.
- Uma exclusão de paciente ainda cai inteira no `audit_log`: a cascata do Postgres dispara a
  trigger de auditoria em cada linha de `anamnesis`/`anthropometric_assessments`/`meal_plans`
  removida, então o rastro de "o que existia antes de ser apagado" fica registrado mesmo sendo
  uma exclusão real.

---

## D6 — Central de Envio substitui o portal do paciente por ora

**Decisão:** em vez de abrir a Fase 8 (área do paciente, login próprio), o AuriNutri ganhou uma
"Central de Envio" — uma aba no perfil do paciente que reúne tudo que já podia ser mandado por
WhatsApp (plano alimentar com link assinado, receitas do plano, lembrete de consulta, mensagem
livre) num só lugar, com mensagem pronta e editável antes de enviar.

**Data:** 2026-09-20

**Justificativa (do responsável pelo produto):** reafirma D2. A Fase 8 foi cogitada logo após o
fim do V1 e conscientemente adiada na mesma conversa (ver nota em D2 e em
`MASTER_DEVELOPMENT_PLAN.md`, Fase 8 marcada `ADIADA`) — abrir login de paciente é uma segunda
superfície de autenticação, com risco real de expor dado clínico entre pacientes, por um ganho
(paciente recebe o material) que já existia de outra forma. A Central de Envio é o "melhor do que
nada" que fecha essa lacuna sem esse risco: nenhuma conta nova, nenhuma RLS nova para paciente,
só uma tela que organiza o que o profissional já fazia manualmente (copiar link, abrir WhatsApp,
colar).

**Impacto técnico:**
- Nenhuma tabela nova de sessão/autenticação de paciente. Reaproveita integralmente o mecanismo de
  link assinado do plano (`plan_share_tokens`, `createPlanShareLink`, Fase 4) — não criou um
  segundo sistema de links.
- Sem tabela de registro de envios (decisão tomada junto: não rastrear o que foi mandado).
- `docs/patient_documents` (item "documentos gerados para o paciente", cogitado originalmente na
  Fase 7) foi deliberadamente deixado de fora da Central — não existe essa funcionalidade no
  projeto ainda, e criar um upload de documento só para caber aqui seria escopo bem maior que uma
  tela de envio. Fica para se um dia for construído como recurso próprio.
- Se a Fase 8 for retomada no futuro, a Central de Envio não precisa ser desfeita — ela continua
  fazendo sentido como atalho rápido do dia a dia mesmo que exista um portal completo depois.

**Atualização (2026-09-20) — redesenho:** o botão "Enviar" saiu de aba própria e virou um diálogo
no cabeçalho do paciente (ao lado de "Exportar dados"/"Editar dados"), com seleção por checkbox de
5 itens: Plano Alimentar, Evolução Física, Impressos, Lembrete de consulta e Mensagem livre.
Evolução Física (PDF com todas as avaliações antropométricas) e Impressos (qualquer receita do
profissional, não só as do plano ativo, + PDFs avulsos do computador) passaram a ser enviados
como **PDF de verdade**, não texto solto — generalizando o mecanismo de link assinado do plano
(`plan_share_tokens`) para uma tabela nova, `document_share_tokens` (migration 0024), com sua
própria função `get_shared_document` (mesmo padrão de segurança: token exato, nada enumerável).
A seção antiga "Receitas do plano" (texto solto via WhatsApp) foi removida — Impressos a substitui
por completo. O link do Plano Alimentar em si não mudou (WhatsApp continua sem suportar anexar
arquivo de verdade — só texto/link; decisão explícita do responsável pelo produto: manter assim
por ora, revisitar mecanismo de anexo real depois).

---

## Como revisitar

Qualquer mudança em D1 ou D2 deve vir com uma nova entrada neste arquivo (não sobrescrever as
anteriores), explicando o gatilho da mudança e o plano de migração dos dados existentes.
