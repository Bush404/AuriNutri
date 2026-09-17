# MASTER_DEVELOPMENT_PLAN — AuriNutri

**Versão:** 1.0 · **Data:** 09/09/2026
**Base:** `docs/PROJECT_AUDIT.md`

---

## Como usar este documento

Uma fase por vez. Ao final de cada fase, apresentar o checkpoint (implementado / testado / problemas / decisões / próximo passo) e atualizar este arquivo e o `DEVELOPMENT_ROADMAP.html`.

**Status:** `TODO` · `IN_PROGRESS` · `BLOCKED` · `DONE`
**Prioridade:** `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`

Uma tarefa só é `DONE` quando: funciona, valida entrada, tem loading, tem empty state, trata erro, respeita RLS, não vaza dados entre profissionais e tem teste proporcional ao risco.

---

## Definição de escopo

### MVP — "Do primeiro paciente ao primeiro plano"
Fases 0 a 4. Um nutricionista consegue cadastrar pacientes, avaliar, montar plano e entregar um PDF com sua identidade. **É o mínimo para cobrar.**

### V1 — Produto profissional
+ Fases 5 a 7. Agenda, receitas, base TACO completa, WhatsApp.

### V2 — Colaboração
+ Fases 8 a 10. Área do paciente, biblioteca, comunidade.

### V3 — Expansão
Financeiro avançado, automações, inteligência.

**Regra de foco:** nenhuma funcionalidade de V2/V3 entra antes do MVP estar nas mãos de nutricionistas reais.

---

## PHASE 0 — Auditoria · `DONE` · `CRITICAL`

**Objetivo:** entender o existente antes de alterar.
**Entregue:** `PROJECT_AUDIT.md`, `MASTER_DEVELOPMENT_PLAN.md`, `DEVELOPMENT_ROADMAP.html`.

---

## PHASE 1 — Fundação e rede de segurança · `DONE` · `CRITICAL`

**Objetivo:** tornar seguro alterar o sistema. Nada de funcionalidade nova.

**Dependências:** nenhuma.

**Por que primeiro:** o cálculo nutricional gera dado clínico. Hoje não há teste que impeça uma regressão silenciosa. E qualquer erro em produção vira tela branca.

### Tarefas

```
[x] Configurar Vitest + @testing-library/react
[x] Testes unitários de lib/nutrition.ts (proporção, soma, snapshot, valores nulos)
[x] Testes dos schemas Zod (campos numéricos opcionais vazios)
[x] Criar src/app/(app)/error.tsx e loading.tsx
[x] Criar src/app/(auth)/error.tsx
[x] Criar src/app/global-error.tsx e not-found.tsx
[x] Gerar tipos reais: supabase gen types typescript > src/lib/types/database.generated.ts
[~] Reintroduzir o generic <Database> nos clients com os tipos gerados — tentado e revertido, ver D3
[x] Remover a interface Database escrita à mão
[x] Paginação em /pacientes, /alimentos e /planos (range + controles)
[x] Migration 0003: índice gin_trgm_ops para busca ilike
[x] Debounce na busca de pacientes (250ms, igual ao combobox)
[x] Migrar deploy Netlify para repositório Git
[x] Apagar .env.production; usar variáveis do painel
[x] Configurar SMTP próprio (Resend ou Brevo) no Supabase
[x] DECIDIR e documentar: multi-tenancy (individual vs clínica)
[x] DECIDIR e documentar: paciente como usuário autenticado ou não
[x] Registrar as duas decisões em docs/DECISIONS.md
```

**Fechada em 2026-09-16** (commit `78e0796`, "Fecha itens da Fase 1: testes, telas de
erro, paginação, busca e SMTP"). Detalhe do generic `<Database>`: religar quebrou
`.insert()`/`.update()` com erros de `never` (mesma classe de bug já conhecida para
`select()`), causa provável a versão instalada de `@supabase/supabase-js` não entender o
campo `__InternalSupabase.PostgrestVersion` dos tipos gerados — decisão de não atualizar
o SDK agora (exigiria revisar todo o fluxo de auth) registrada como **D3** em
`docs/DECISIONS.md`. Tipos gerados ficam no repo (`database.generated.ts`) para uso
manual via `.returns<T>()`/`.single<T>()`, sem o generic global.

### Critérios de aceite
- [x] `npm test` roda e passa (37/37 nesta fase).
- [x] Erro em qualquer rota mostra tela de recuperação, não tela branca.
- [~] Alterar uma coluna no banco e rodar `gen types` quebra o build se o código estiver desatualizado — não aplicável enquanto o generic `<Database>` ficar fora dos clients (D3); tipos gerados existem mas não são obrigatórios no build.
- [x] Listagem com 500 registros carrega em página de 20.
- [x] E-mail de recuperação chega — confirmado via Resend, **mas só em modo sandbox**: só entrega pro e-mail dono da conta Resend, não para nutricionistas reais, até haver domínio próprio verificado. Ver pendência abaixo.
- [x] `DECISIONS.md` responde às duas perguntas com justificativa (D1 e D2).

### Arquivos prováveis
`vitest.config.ts`, `src/lib/nutrition.test.ts`, `src/lib/validations/*.test.ts`, `src/app/(app)/{error,loading}.tsx`, `src/app/{global-error,not-found}.tsx`, `src/lib/types/database.generated.ts`, `src/lib/supabase/{client,server,middleware}.ts`, `supabase/migrations/0003_search_indexes.sql`, `docs/DECISIONS.md`

### Riscos
Reintroduzir o generic `<Database>` pode ressuscitar os erros de `never` — por isso usar tipos **gerados**, não manuais. Se o problema voltar, manter untyped e documentar. (Aconteceu — ver D3.)

### QA
Rodar suíte; forçar erro em Server Component e verificar `error.tsx`; testar paginação com dados de volume; enviar recuperação de senha para 3 provedores.

### Pendências operacionais (não bloqueiam desenvolvimento local)
- **SMTP em modo sandbox:** decisão de 2026-09-17 é continuar no Resend sandbox por ora
  (sem comprar domínio ainda). Onboarding de nutricionistas reais continua bloqueado até
  isso mudar — revisitar quando houver um domínio.
- **Créditos Netlify esgotados** (desde 2026-09-16): deploy ao vivo trava até o reset
  mensal ou upgrade de plano. Não afeta desenvolvimento local nem commits/push. Ainda sem
  previsão de retomada, conforme confirmado em 2026-09-17.

---

## PHASE 2 — Identidade profissional · `DONE` · `HIGH`

**Objetivo:** o nutricionista existe como profissional, não só como login. Pré-requisito de todo documento gerado.

**Dependências:** Fase 1.

### Tarefas

```
[x] Migration 0004: profiles += telefone, crn_uf, especialidade,
    logo_url, assinatura_url, cor_marca, endereco, bio
[x] Configurar Supabase Storage: bucket privado 'profissional'
[x] Políticas de Storage (cada um acessa só a própria pasta)
[x] Componente de upload com preview, limite de tamanho e tipo
[x] Página /perfil com formulário
[x] Ativar item "Editar perfil" na topbar
[x] Exibir CRN e nome no layout
[x] Validação de formato de CRN
[x] Teste: upload não acessível por outro usuário
```

**Bloco A (2026-09-16) — backend:** migration `0004_professional_profile.sql` aplicada
(colunas nullable em `profiles`, bucket privado `profissional`, policies de
storage.objects restringindo cada usuário à própria pasta via
`(storage.foldername(name))[1] = auth.uid()`).

**Bloco B (2026-09-16) — UI:** `ProfileForm` + `ImageUpload` (`src/components/profile/`),
Server Actions `updateProfile` / `uploadProfileFile` / `getProfileFileSignedUrl`
(`src/lib/actions/profile.ts`), página `/perfil`, item "Editar perfil" da topbar
ativado e logo do profissional exibida no avatar da topbar (via URL assinada).
Upload valida tipo/tamanho tanto no cliente quanto no servidor. Nenhuma
biblioteca nova foi adicionada.

**Teste de isolamento (2026-09-16):** critério de aceite "URL de arquivo de
outro profissional retorna 403" verificado na prática com `npm run
test:storage-isolation` (`scripts/test-storage-isolation.mjs`) — cria 2 contas
descartáveis, confirma que uma não consegue ler/baixar/enviar/apagar arquivo
na pasta da outra, e limpa tudo ao final. **5/5 testes passaram.** Script fica
no repo para reexecutar caso as policies de storage mudem no futuro; exige
`SUPABASE_SERVICE_ROLE_KEY` temporário no `.env.local` (mesmo fluxo do
`import:taco`), removido logo depois de rodar.

**CRN e nome no layout (2026-09-16):** topbar passou a receber `crn`/`crn_uf`
do profile (buscados em `(app)/layout.tsx`) e exibe "CRN 12345/SP" ao lado do
nome, sem alterar a altura do cabeçalho. Some da tela quando o campo está
vazio, sem quebrar layout.

**Bloco C (2026-09-16) — teste automatizado de segurança:**
`scripts/test-storage-isolation.mjs` reescrito para cobrir os 6 cenários
pedidos: (1) usuário B tenta acessar o arquivo de A pelo caminho direto —
download e signed URL, ambos negados; (2) B tenta listar a pasta de A — RLS
filtra e retorna lista vazia, sem erro; (3) B tenta sobrescrever o arquivo de
A (mesmo path, `upsert:true`) — negado, e o conteúdo do arquivo de A é
verificado byte a byte para confirmar que não mudou; (4) uma URL assinada de
TTL curto (1s) é gerada pelo dono, o script espera 3s e confirma via `fetch`
real que ela responde HTTP 400, não mais o arquivo. **7/7 verificações
passaram — nenhuma falha de segurança encontrada.**

O script segue a regra pedida: se qualquer verificação que deveria falhar
tivesse passado (acesso indevido bem-sucedido), ele para imediatamente
(`SecurityBreachError`), imprime um alerta e sai com erro — sem tentar
contornar. Não foi necessário acionar esse caminho nesta execução.

**Nota técnica (não é uma falha):** o critério de aceite fala em "retorna
403", mas o Supabase Storage responde com **404 "Object not found"** para
select/download negado pela RLS, em vez de 403. Isso é intencional do lado
do Supabase — evita confirmar para um usuário não autorizado que o arquivo
sequer existe (um 403 revelaria a existência do objeto; um 404 não revela
nada). Já a tentativa de upload/overwrite indevido retorna o erro esperado
de violação de RLS. Comportamento equivalente ou mais seguro que um 403
literal — não é dívida técnica.

### Critérios de aceite
- [x] Perfil completo persiste e reflete na topbar.
- [x] Logo e assinatura fazem upload e aparecem no preview.
- [x] URL de arquivo de outro profissional retorna 403 (na prática, 404 — ver nota técnica acima).
- [x] CRN validado.

### Riscos
Storage mal configurado vaza arquivo entre contas. **Testado explicitamente antes de fechar a fase — ver Bloco C.** Nenhum vazamento encontrado.

---

## PHASE 3 — Consultório clínico completo · `DONE` · `HIGH`

**Objetivo:** fechar as lacunas do atendimento e preservar histórico clínico.

**Dependências:** Fases 1 e 2.

### Tarefas

```
[x] Migration 0006: anamnesis versionada (1:N com data_registro)
[x] Migration 0005: deleted_at em anamnesis, assessments, meal_plans, meals,
    meal_items, foods (NÃO em patients — ver D5)
[x] Migration 0005: tabela audit_log (tabela, registro_id, acao, user_id, timestamp, diff)
[x] Trigger de auditoria nas tabelas clínicas
[x] Soft delete nas actions de exclusão pontual (assessment/plano/refeição/item)
[x] Filtrar deleted_at nas policies RLS
[x] Editar avaliação antropométrica (updateAssessment)
[x] Histórico de anamneses no perfil (linha do tempo)
[x] Exportar dados do paciente (LGPD - portabilidade)
[x] Confirmação ao sair de formulário com alterações não salvas
[x] Teste: exclusão de paciente (real e definitiva, por decisão de produto)
[x] Teste: audit_log registra alteração clínica + isolamento entre profissionais
```

**Bloco A (2026-09-16) — soft delete estrutural + auditoria:** migration
`0005_soft_delete_audit.sql`. `deleted_at` entra na cláusula `USING` das
policies de `SELECT` (não em queries da aplicação) — um registro excluído
fica invisível mesmo que uma query futura esqueça de filtrar. Índices
parciais (`where deleted_at is null`) recriados para não degradar com o
tempo. Tabela `audit_log` com policy de `SELECT` própria e nenhuma policy de
escrita — só a trigger `log_audit_event` (security definer) grava, nunca a
API. **Decisão de produto D5** (ver `docs/DECISIONS.md`): excluir um
**paciente** continua sendo definitivo (apaga tudo em cascata, como já era);
o soft delete vale só para exclusões pontuais dentro de um paciente ativo
(avaliação, plano, refeição, item). A migration precisou de um ajuste manual
em produção no meio do caminho — documentado como aprendizado em
`docs/DECISIONS.md` (D5) e na memória do projeto.

**Bloco B (2026-09-16) — anamnesis 1:N:** migration `0006_anamnesis_versionada.sql`
remove a constraint `UNIQUE(patient_id)` (localizada por introspecção do
catálogo, não por nome assumido) e adiciona `data_registro`, com backfill a
partir de `created_at` para preservar a data real dos registros existentes.
`createAnamnesis`/`updateAnamnesis` substituem `upsertAnamnesis`. A aba
Anamnese virou uma linha do tempo (`AnamnesisTimeline`) com botão "Nova
anamnese" e edição pontual por registro. Testado com
`npm run test:anamnesis-history` (duas anamneses do mesmo paciente, ambas
persistem).

**Bloco C (2026-09-16) — UX clínico + LGPD + testes finais:**
- `updateAssessment` + `NewAssessmentDialog` reaproveitado em modo edição
  (botão de editar ao lado do de excluir em cada avaliação).
- Exportação de portabilidade LGPD (`exportPatientData` +
  `ExportPatientButton`): baixa um `.json` com cadastro, anamneses,
  avaliações e planos (com refeições e itens) do paciente.
- Aviso de alterações não salvas (`useUnsavedChangesWarning`): cobre
  `beforeunload` (fechar aba/atualizar) e clique em qualquer link interno
  (intercepta na fase de captura, antes do `<Link>` do Next navegar).
  Aplicado em `PatientForm` e `AnamnesisForm`. **Não cobre o botão
  voltar/avançar do navegador** (popstate) — fora de escopo, anotado como
  limitação conhecida.
- Confirmação reforçada de exclusão de paciente: precisa digitar "excluir"
  no dialog antes do botão habilitar, já que a exclusão é definitiva (D5).
- 3 scripts de teste novos: `test:patient-deletion` (exclusão é real e some
  da listagem), `test:audit-log` (alteração clínica gera linha + um
  profissional não vê o audit_log de outro). Todos passaram.

### Critérios de aceite
- [x] Excluir paciente o remove da lista **e apaga os dados de verdade** (D5 — mudou do critério original "preserva os dados"; ver justificativa em DECISIONS.md).
- [x] Nova anamnese não sobrescreve a anterior; ambas visíveis com data.
- [x] Toda alteração em dado clínico gera linha em `audit_log`, e é isolada por profissional (RLS).
- [x] Exportação gera JSON completo do paciente (cadastro + anamneses + avaliações + planos). PDF fica para a Fase 4, que já tem geração de PDF no escopo.

### Riscos (mitigado)
Soft delete exigiria revisar **todas** as queries existentes se o filtro dependesse de disciplina de código. Mitigado colocando `deleted_at is null` na própria policy de RLS — nenhuma query da aplicação precisa se lembrar de filtrar.

---

## PHASE 4 — Plano alimentar profissional + PDF · `DONE` · `CRITICAL`

**Objetivo:** fechar o MVP. O nutricionista entrega ao paciente um plano com a sua marca.

**Dependências:** Fases 2 e 3.

**Por que é o coração do MVP:** é o artefato que justifica a assinatura. E é hoje o fluxo mais custoso do produto (~40 interações para um plano de 5 refeições).

### Tarefas

```
[x] Importar TACO completa (597 alimentos) via pipeline brolesi/taco
[x] Duplicar plano alimentar existente
[x] Templates de refeição reutilizáveis
[x] Substituições de alimento na refeição (equivalentes)
[x] Observações por refeição
[x] Meta calórica/macros do plano + comparativo com o calculado
[x] Cálculo de gasto energético (Harris-Benedict / Mifflin-St Jeor)
[x] Geração de PDF do plano com identidade do profissional
[x] Rodapé de fonte no PDF (buildFonteFooter já existe)
[x] Compartilhar PDF via WhatsApp (link wa.me)
[x] Teste: macros do PDF conferem com a tela
```

**Bloco A (2026-09-17) — base de dados e cálculo:** TACO completa importada
(597 alimentos, upsert atualizou os 43 já existentes com os micronutrientes
que faltavam). `src/lib/energy.ts` — Mifflin-St Jeor (padrão) e
Harris-Benedict (alternativa), fator de atividade física, 10 testes com
valores calculados diretamente das fórmulas publicadas. `sexo = 'outro'` (ou
sem sexo cadastrado) nunca é assumido: a calculadora pede pro profissional
escolher uma base ou aceita GET manual. Migration `0007`: `meta_kcal`,
`meta_proteinas_g`, `meta_carboidratos_g`, `meta_gorduras_g` em `meal_plans`
+ comparativo visual na tela (`compareToGoal`, movida para `nutrition.ts`
pra ser reaproveitada depois pelo PDF).

**Bloco B (2026-09-17) — reduzir esforço de montar plano:** duplicar plano
(migration nenhuma — copia snapshots verbatim, `fonte_alimento`/
`fonte_descricao_alimento` inclusos). Templates de refeição (migration
`0008`: `meal_templates` + `meal_template_items`, sem snapshot — decisão
deliberada, ver comentário na migration) com salvar/aplicar/excluir.
Substituições com sugestão automática de quantidade por aporte calórico
semelhante (migration `0009`: `meal_item_substitutions`, com snapshot igual
a `meal_items`). Observações por refeição. Extraído `buildFoodSnapshot` em
`nutrition.ts` pra centralizar a cópia de campos usada em item novo,
substituição e item de template aplicado — nunca reimplementada em mais de
um lugar.

**Bloco C (2026-09-17) — geração de PDF:** avaliado `@react-pdf/renderer` vs.
Puppeteer antes de implementar (aprovado pelo usuário) — Puppeteer precisa de
um Chromium inteiro (~200MB+, vários segundos de cold start) dentro do limite
fixo de 10s/1024MB das Netlify Functions; `@react-pdf/renderer` é JS puro,
renderizou um PDF completo em **56ms** no teste real. PDF servido via Route
Handler (`GET /planos/[id]/pdf`), mesmo mecanismo já usado em
`auth/callback`. Toda a lógica de números vive em `plan-pdf-data.ts`, uma
função pura que só chama `calculatePlanTotals`/`calculateMealTotals`/
`calculateMealItemMacros`/`buildFonteFooter`/`compareToGoal` — nunca
reimplementa. 5 testes comparando os totais do PDF com os da tela + 1 smoke
test renderizando um PDF de verdade. Amostra visual conferida manualmente
(acentos em português corretos).

**Bloco D (2026-09-17) — compartilhamento por link:** PDF salvo no bucket
privado `planos` (isolado por pasta, mesmo padrão do bucket `profissional`).
Migration `0010`: `plan_share_tokens` (token aleatório, válido por 90 dias,
revogável) + função `get_shared_plan_pdf` (`security definer`, mesmo padrão
de `handle_new_user`/`log_audit_event`) — única forma de um visitante sem
sessão (o paciente, D2) acessar o PDF, exigindo o token exato; nenhuma
policy de `SELECT` pública foi criada em nenhuma tabela ou bucket, pra evitar
enumeração de links ativos. A revogação funciona de verdade porque a rota
pública (`/compartilhado/[token]`) nunca expõe a signed URL do Supabase
diretamente — sempre repassa os bytes, revalidando a cada acesso. Botão
"Enviar por WhatsApp" monta um link `wa.me` com o telefone do paciente (ou
sem número, se não cadastrado — abre o seletor de contato). 5 testes
automatizados: token válido resolve, revogado não abre, expirado não abre,
token inexistente não abre, e outro profissional não enxerga o token alheio
pela própria tabela (RLS).

**Validação do critério "5 refeições em menos de 5 minutos" (item 5,
2026-09-17):** análise por contagem de interações, não cronometragem real. Do
zero, sem reaproveitar nada, o gargalo antigo (buscar/selecionar/digitar
quantidade por alimento) continua idêntico — plausivelmente ainda passa de 5
minutos pra um usuário cuidadoso. Usando os recursos desta fase (templates +
duplicar plano), uma refeição inteira sai em ~3-4 interações independente de
quantos alimentos tenha, o que coloca um plano de 5 refeições bem abaixo de 5
minutos nesse cenário.

**Critério descartado por decisão do responsável pelo produto (2026-09-17):**
a cronometragem real não vai ser feita — a análise por interações acima é
suficiente pra fechar a fase. Não fica pendência aberta sobre isso.

### Critérios de aceite
- [~] Montar plano de 5 refeições em menos de 5 minutos — critério descartado (não cronometrado), ver nota acima.
- [x] PDF sai com logo, nome, CRN e atribuição correta de fonte.
- [x] Duplicar plano cria cópia independente (snapshots preservados).
- [x] Totais do PDF idênticos aos da tela (testado, não só verificado visualmente).

### Riscos (mitigado)
Geração de PDF em serverless tem limite de memória/tempo. Resolvido optando por `@react-pdf/renderer` em vez de Puppeteer — confirmado na prática (56ms de renderização, bem dentro do limite de 10s do Netlify).

### 🏁 Fim do MVP — parar e validar com nutricionistas reais antes de seguir.

---

## PHASE 5 — Agenda e rotina · `DONE` · `HIGH`

**Dependências:** Fases 3 e 4, e a decisão de multi-tenancy (D1, já resolvida na Fase 1).

```
[x] Migration 0011: appointments (paciente, data_hora timestamptz, duracao, status, tipo, observacoes, deleted_at)
[x] Migration 0011: tasks (pendências vinculadas a paciente/consulta, deleted_at)
[x] profiles.fuso_horario — fuso IANA do profissional, usado para toda conversão
[x] Calendário mensal e semanal (construído à mão, sem biblioteca — ver Bloco B)
[x] CRUD de agendamento
[x] Status: agendado, confirmado, realizado, faltou, cancelado
[x] Consulta mostra pendências do paciente
[x] Próximos atendimentos no dashboard
[x] Lembrete via WhatsApp (link)
[x] Horários em intervalos de 15 minutos + campos de início/término
[x] Impedir agendamentos sobrepostos do mesmo profissional
```

**Bloco A (2026-09-17) — backend e fuso horário:** migration `0011_appointments_tasks.sql`
com as duas tabelas, seguindo exatamente o padrão de soft delete + RLS da
migration 0005 (`deleted_at is null` na policy de SELECT). `profiles` ganhou
`fuso_horario` (default `America/Sao_Paulo`). Criado `src/lib/timezone.ts`
com `zonedWallTimeToUtc`/`utcInstantToZonedDateTime`: a conversão entre
horário de parede digitado e o instante UTC gravado usa sempre o fuso salvo
no perfil, nunca o fuso do processo que executa o código — resolve o "bug
clássico" de serverless rodando num fuso diferente do profissional. Sem
biblioteca nova (só `Intl`, já embutido no Node). Server Actions de CRUD em
`src/lib/actions/appointments.ts`/`tasks.ts`, incluindo `rescheduleAppointment`
(atualiza só a data/hora, usado pelo botão de remarcar e pelo arrastar).

**Bloco B (2026-09-17) — interface de calendário:** avaliada biblioteca de
calendário (FullCalendar/react-big-calendar) vs. construir à mão antes de
implementar (aprovado pelo usuário) — decisão por construir à mão, mesmo
racional já usado no gráfico de evolução manual: zero dependência nova,
controle total do visual (paleta verde/shadcn) e nenhum risco de uma segunda
camada de fuso horário conflitando com a do Bloco A. Página `/agenda` com
visão mensal (grade por semana, chips por dia) e semanal (grade por horário,
rolagem horizontal no mobile). Criar consulta clicando num dia/horário.
Arrastar verticalmente (mesmo dia) para remarcar na visão semanal via
Pointer Events nativos, com botão "Remarcar" como alternativa sempre
disponível (mês, mobile, ou quando preferir não arrastar). Cores por status
e filtros por status/paciente reaproveitando os tokens de cor já existentes
(nenhuma cor nova). Testado no navegador com dados reais — um bug real foi
encontrado e corrigido (`min`/`step` inconsistentes no campo de duração
bloqueavam o envio do formulário).

**Bloco C (2026-09-17) — contexto clínico:** regras de pendência propostas
e revisadas com o usuário antes de implementar. `src/lib/patient-context.ts`
(puro, testável) calcula: sem anamnese, nunca avaliado vs. avaliação
desatualizada (>60 dias — casos distintos de propósito), sem plano ativo vs.
plano desatualizado (>90 dias — idem), faltou na última consulta, e sem
telefone cadastrado (proposta extra do assistente, aceita pelo usuário,
por bloquear o lembrete via WhatsApp). Os limiares (60/90 dias) são
constantes isoladas, ajustáveis sem tocar no resto do código. Painel de
contexto (`PatientContextPanel`) dentro do diálogo de agendamento mostra
última consulta (com status), última avaliação (com evolução de peso —
sem cor de "bom/ruim", já que subir ou descer pode ser o objetivo do
paciente), plano ativo e anamnese, mais ações rápidas: ver perfil, nova
avaliação, criar plano (reaproveitando `NewAssessmentDialog`/
`NewMealPlanDialog` já existentes), marcar como realizado e lembrete via
WhatsApp (`buildWhatsAppUrl` extraído de `share-plan-dialog.tsx` para
`src/lib/whatsapp.ts`, reaproveitado nos dois lugares). Dashboard ganhou a
seção "Próximos atendimentos (7 dias)" com as mesmas pendências.

**Bloco D (2026-09-17) — correção pós-uso, a partir do teste do usuário:**
três lacunas reais encontradas usando a agenda de verdade, não por leitura
de código: (1) os campos de horário aceitavam qualquer minuto; (2)
**nada impedia marcar dois pacientes no mesmo horário** — bug de
correção, não capricho; (3) o usuário preferia informar início e término
explícitos em vez de início + duração. Corrigido: `step={900}` (15 min) em
todo input de horário + validação equivalente no Zod; `AppointmentFormDialog`
passou a ter campos "Início"/"Término" (a duração continua sendo o que é
gravado, só a forma de preencher mudou); e uma **exclusion constraint no
Postgres** (migration `0012_appointments_no_overlap.sql`) impede dois
agendamentos sobrepostos do mesmo profissional (exclui cancelados),
somada a uma checagem prévia na Server Action que dá uma mensagem
amigável com o horário do conflito antes de chegar no banco — mesmo
racional de "a garantia mora no banco" já usado no soft delete (migration
0005). A migration precisou de 3 tentativas: `timestamptz + interval` e
`extract(epoch from timestamptz)` são `STABLE` no Postgres, não
`IMMUTABLE` (exigido em expressão de índice GiST), mesmo quando o valor
específico não dependeria de fuso — resolvido gravando `data_fim` como
coluna comum, calculada pela aplicação, não por expressão SQL. Testado ao
vivo: tentativa de agendar em cima de um horário ocupado foi rejeitada com
a mensagem correta.

### Critérios de aceite
- [x] Agendamento de outro profissional não é visível nem editável — testado com `npm run test:appointments-isolation` (RLS, 2 contas descartáveis).
- [x] Horário salvo aparece correto independentemente do fuso do servidor — testado forçando `process.env.TZ` para um fuso bem diferente (`timezone.test.ts`).
- [x] Regras de pendência disparam nas condições certas — 17 testes unitários (`patient-context.test.ts`), incluindo casos de limite exato (60/90 dias).
- [x] Consulta mostra o contexto do paciente (última consulta, avaliação, plano, anamnese, pendências).
- [x] Dashboard lista os próximos 7 dias com as pendências de cada atendimento.
- [x] Não é possível agendar dois pacientes no mesmo horário — testado ao vivo (mensagem de conflito) e garantido por exclusion constraint no banco.

### Riscos (mitigado)
Fuso horário. Resolvido convertendo explicitamente com o fuso salvo no perfil do profissional via `Intl` (nunca o fuso do processo/servidor) — testado forçando `process.env.TZ` para um fuso bem diferente do Brasil, mesmo resultado.

---

## PHASE 6 — Receitas e preparações · `TODO` · `MEDIUM`

**Dependências:** Fase 4.

```
[ ] Migration 0007: recipes + recipe_ingredients (rendimento, porção)
[ ] Cálculo nutricional derivado dos ingredientes
[ ] CRUD de receita com imagem
[ ] Usar receita como item de plano alimentar (com snapshot)
[ ] Tags e busca
```

**Decisão registrada:** receita é entidade própria, não extensão de `foods`. Uma receita tem ingredientes, rendimento e porção — semântica diferente.
**Risco:** o snapshot precisa capturar a receita inteira no momento do uso.

---

## PHASE 7 — Exames e evolução visual · `TODO` · `MEDIUM`

**Dependências:** Fase 2 (storage).

```
[ ] Migration 0008: lab_exams, patient_photos, patient_documents
[ ] Upload de exames (PDF/imagem) com storage privado
[ ] Marcadores laboratoriais estruturados + faixas de referência
[ ] Evolução fotográfica com comparação lado a lado
[ ] Consentimento explícito para fotos (LGPD)
```

**Risco alto:** foto de paciente é dado sensível. Exige consentimento registrado, storage privado e URLs assinadas de curta duração. **Não implementar sem isso.**

---

## PHASE 8 — Área do paciente · `TODO` · `HIGH` (V2)

**Dependências:** decisão de identidade do paciente (Fase 1) + Fases 4 e 5.

```
[ ] Modelo de autenticação do paciente (convite por link/e-mail)
[ ] Migration 0009: patient_users, vínculo com patients
[ ] RLS: paciente vê apenas os próprios dados
[ ] Layout mobile-first separado
[ ] Visualizar plano, receitas, documentos
[ ] Registro diário (refeições, água)
[ ] Próxima consulta
```

**Risco:** é uma segunda superfície de autenticação e autorização. Erro de RLS aqui expõe dado clínico ao paciente errado. Exige revisão de segurança dedicada.

---

## PHASE 9 — Financeiro · `TODO` · `MEDIUM` (V2)

```
[ ] Migration 0010: transactions, payments
[ ] Receitas e despesas
[ ] Pagamentos pendentes por paciente
[ ] Recibos com identidade profissional
[ ] Visão mensal, ticket médio
```

**Escopo:** ajudar a entender o consultório, não virar ERP.

---

## PHASE 10 — Biblioteca e comunidade · `TODO` · `LOW` (V2/V3)

**Dependências:** base de usuários ativa. **Não iniciar antes disso.**

```
[ ] Biblioteca pessoal vs oficial vs comunitária
[ ] Compartilhar receita/alimento
[ ] "Adicionar à minha biblioteca" (referência, sem duplicar)
[ ] Anonimização automática de casos clínicos
[ ] Moderação e denúncia
[ ] Feed de discussões
```

**Risco crítico:** caso clínico compartilhado sem anonimização adequada é incidente de LGPD. A anonimização automática (remover nome, CPF, telefone, data de nascimento) precisa ser validada antes de qualquer publicação. Comunidade sem moderação vira passivo legal.

---

## PHASE 11 — Polimento, acessibilidade e QA · `TODO` · `HIGH`

**Contínua, com auditoria formal antes de cada release.**

```
[ ] Auditoria de contraste (WCAG AA)
[ ] Navegação completa por teclado
[ ] Alternativa textual para o gráfico de evolução
[ ] Revisão de responsividade (tabela de plano no mobile)
[ ] Testes E2E dos fluxos críticos (Playwright)
[ ] Teste de isolamento entre profissionais
[ ] Observabilidade (Sentry)
[ ] Rate limiting nas Server Actions
[ ] Política de senha forte
```

---

## Ordem recomendada

```
1 → 2 → 3 → 4 → [MVP · validar com usuários reais]
     → 5 → 6 → 7 → [V1]
     → 8 → 9 → 10 → [V2]
11 permeia todas.
```

---

## Decisões pendentes (bloqueiam fases futuras)

**D1 e D2 já foram decididas** (2026-09-12, Fase 1) — ver `docs/DECISIONS.md`.
D1: contas individuais, sem clínica/equipe. D2: paciente não é usuário
autenticado. Removidas desta tabela porque não bloqueiam mais nada; o texto
completo com justificativa continua em `DECISIONS.md`, não sobrescrito.

| # | Decisão | Bloqueia | Prazo |
|---|---|---|---|
| D3 | Licenciamento de TBCA e Tucunduva | Fase 4 | Antes de importar |
| D4 | Biblioteca de PDF | Fase 4 | Fase 4 |

**Sobre D3:** a TACO autoriza reprodução com citação de fonte. **TBCA e Tucunduva não foram verificados.** A Tucunduva é obra comercial protegida — redistribuir seus dados num SaaS pago é provavelmente inviável sem licença. Isso exige parecer jurídico, não decisão de engenharia.
