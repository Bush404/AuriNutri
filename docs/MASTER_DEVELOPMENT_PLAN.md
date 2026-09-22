# MASTER_DEVELOPMENT_PLAN — AuriNutri

**Versão:** 1.0 · **Data:** 09/09/2026
**Base:** `docs/PROJECT_AUDIT.md`

---

## Como usar este documento

Uma fase por vez. Ao final de cada fase, apresentar o checkpoint (implementado / testado / problemas / decisões / próximo passo) e atualizar este arquivo e o `DEVELOPMENT_ROADMAP.html`.

**Status:** `TODO` · `IN_PROGRESS` · `BLOCKED` · `DONE` · `ADIADA` (parada por decisão de produto — ver `docs/DECISIONS.md` — não por dependência técnica pendente, essa é a diferença de `BLOCKED`)
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

## PHASE 6 — Receitas e preparações · `DONE` · `MEDIUM`

**Dependências:** Fase 4.

```
[x] Bloco 0 (pré-requisito): micronutrientes no cadastro de alimento personalizado
[x] Migration 0013: recipes + recipe_ingredients (rendimento, porção, snapshot dos ingredientes)
[x] Cálculo nutricional derivado dos ingredientes (total / por porção / por 100g, fator de cocção)
[x] CRUD de receita com imagem (wizard de 4 etapas, rascunho progressivo)
[x] Correção manual de qualquer macro/micro calculado (valores_sobrescritos)
[x] Tags e busca
[x] Usar receita como item de plano alimentar (com snapshot, em porções)
[x] PDF do plano exibe receitas corretamente (quantidade em porções + atribuição de fonte)
```

**Decisão registrada:** receita é entidade própria, não extensão de `foods`. Uma receita tem ingredientes, rendimento e porção — semântica diferente.

**Bloco 0 (2026-09-17) — pré-requisito, micronutrientes em alimento personalizado:**
`FoodFormDialog` só expunha os 5 macros principais, embora `foods` já tivesse
todas as colunas de micronutriente da TACO desde a migration 0002 — um
alimento cadastrado à mão (ex.: whey protein) não conseguia registrar sódio,
ferro, vitaminas etc. Estendido para os 23 micronutrientes, agrupados num
acordeão fechado por padrão (cadastro rápido continua só-macros). Regra
crítica aplicada: campo vazio vira `NULL` no banco, nunca `0`
(`buildMicronutrientFields` em `src/lib/actions/foods.ts`) — e um bug
preexistente equivalente em `fibras_g` (`?? 0` em vez de `?? null`) foi
corrigido de passagem.

**Bloco A (2026-09-17) — backend de receitas:** migration `0013_recipes.sql`
cria `recipes` (com `rendimento_g`/`numero_porcoes` informados pelo
profissional — nunca derivados da soma dos ingredientes, já que cocção
altera peso por perda de água ou absorção) e `recipe_ingredients` (snapshot
nutricional completo por ingrediente, mesmo princípio de `meal_items`:
editar/excluir o alimento de origem depois não muda a receita já salva).
`calculateRecipeTotals`/`calculateRecipePerPortion`/`calculateRecipePer100g`
em `lib/nutrition.ts` operam só sobre esse snapshot. Migration `0014` relaxa
`rendimento_g`/`numero_porcoes` para `NULL` (rascunho progressivo — ver
Bloco B) e `0015` cria o bucket privado `receitas` para as imagens.

**Bloco B (2026-09-17) — wizard de criação, imagem e correção manual:**
CRUD completo num wizard de 4 etapas que salva rascunho a cada etapa
(identificação → modo de preparo → ingredientes → rendimento/porções),
upload de imagem para o bucket privado (URL sempre assinada), tags com
busca/filtro na listagem (`/receitas`). `RecipeNutritionPanel` mostra os
totais em 3 visões (total/por porção/por 100g) com todos os 23
micronutrientes, e permite correção manual de qualquer valor calculado
(`valores_sobrescritos`, mapa `{"<visão>.<campo>": valor}`) sem perder o
calculado original — "limpar" volta a aceitar o cálculo automático.

**Bloco C (2026-09-19) — usar receita no plano alimentar:** decisão de
design tomada com o usuário antes de implementar — snapshot no `meal_item`
guarda só os TOTAIS por porção da receita (macros + conjunto de fontes dos
ingredientes), não a composição ingrediente-a-ingrediente; reaproveita 100%
do modelo já existente para alimentos avulsos, sem tabela nova. Migration
`0018_meal_items_recipe.sql`: `meal_items` ganha `recipe_id` (mutuamente
exclusivo com `food_id`, via CHECK), `quantidade_porcoes` e
`fontes_ingredientes_receita`. `porcao_referencia_g` do snapshot vira os
gramas de UMA porção (`rendimento_g / numero_porcoes`), o que faz
`calculateMealItemMacros` funcionar sem NENHUMA mudança de fórmula — a
receita é só mais um tipo de item do ponto de vista do cálculo.
`buildRecipeSnapshot` (novo, em `lib/nutrition.ts`) aplica eventuais
`valores_sobrescritos` da receita ao snapshot (uma correção manual do
profissional não pode se perder ao levar a receita para um plano) e reúne o
conjunto de fontes dos ingredientes naquele momento. `collectFontesUsadas`/
`buildFonteFooter` passaram a considerar esse conjunto para um item
"receita" (em vez de uma fonte única), garantindo que uma receita com
ingrediente TACO continue creditando o NEPA/UNICAMP no rodapé do plano/PDF
mesmo o item em si não sendo "taco". UI: abas Alimento/Receita no formulário
de adicionar item, `RecipeCombobox` (só receitas finalizadas, não
rascunhos), quantidade sempre em porções (nunca gramas) na tela e no PDF.
A função de duplicar plano (`meal-plans.ts`) precisou ser corrigida para
copiar também `recipe_id`/`quantidade_porcoes`/`fontes_ingredientes_receita`
— sem isso, duplicar um plano com item de receita violaria o novo CHECK.
10 novos testes (`nutrition.test.ts`, `plan-pdf-data.test.ts`): edição da
receita depois de usada não altera o snapshot já gravado, totais do plano
batem com o cálculo manual, atribuição de fonte correta com receita
TACO, e PDF/tela usando exatamente os mesmos números.

**Bug sistêmico de RLS encontrado e corrigido durante o retest do Bloco C
(2026-09-19):** ao testar a exclusão de uma receita, apareceu
`42501 new row violates row-level security policy for table "recipes"`.
Diagnosticado via SQL direto (impersonando a role `authenticated` com o JWT
do usuário) até a causa raiz: TODA tabela com soft delete no projeto
(`recipes`, `anthropometric_assessments`, `meal_plans`, `meals`,
`meal_items`, `appointments`, `tasks`) tinha esse bug — a política de SELECT
filtra `deleted_at is null`, e o Postgres rejeita o UPDATE que torna a
própria linha invisível por essa mesma política, mesmo a política de UPDATE
permitindo a operação. Corrigido na migration `0017_soft_delete_definer_functions.sql`:
cada exclusão passou a rodar por uma função `SECURITY DEFINER` que replica a
checagem de posse (`user_id = auth.uid()`) explicitamente no `WHERE` — a
garantia continua vivendo no banco, só que na função em vez da policy.
Detalhe completo em `docs/PROJECT_AUDIT.md`/memória do projeto.

### Critérios de aceite
- [x] Cálculo nutricional da receita bate com a soma manual dos ingredientes (por porção e por 100g).
- [x] Editar a receita depois de usá-la num plano não altera o plano já montado (testado e coberto por teste automatizado).
- [x] Receita usada num plano é exibida em porções, não em gramas, na tela e no PDF.
- [x] Atribuição de fonte credita TACO quando um ingrediente da receita é TACO, mesmo o item do plano sendo "receita".
- [x] Excluir receita, plano, avaliação, refeição, item ou agendamento funciona de verdade (bug de RLS sistêmico corrigido).
- [x] PDF e tela mostram exatamente os mesmos números (mesma função por baixo dos dois).

### Riscos (mitigado)
O snapshot precisa capturar a receita inteira no momento do uso — resolvido
guardando os totais efetivos por porção (com correção manual aplicada) e o
conjunto de fontes dos ingredientes no `meal_item`, sem depender de uma
junção "ao vivo" com `recipe_ingredients` em nenhum momento do cálculo.

---

## PHASE 7 — Exames e evolução visual · `DONE` · `MEDIUM`

**Dependências:** Fase 2 (storage).

```
[x] Migrations 0019–0023: patient_consents, lab_exams, lab_reference_ranges, lab_markers, patient_photos
[x] Consentimento explícito por tipo de dado (exames/fotos/dados_clínicos), com revogação
[x] Upload de exames (PDF/imagem) com storage privado, bloqueado sem consentimento
[x] Marcadores laboratoriais estruturados + faixas de referência (catálogo global + pessoal, por sexo/idade)
[x] Evolução fotográfica com comparação lado a lado, aba própria
[x] Bucket de fotos SEPARADO do de exames, URLs de 15min, exclusão física do arquivo
[x] Trilha de auditoria de quem visualizou qual foto e quando
```

**Bloco A (2026-09-19) — base de consentimento:** tabela `patient_consents`
(migration 0019). Cada linha é um evento IMUTÁVEL — revogar nunca edita
nem apaga o histórico, só marca `concedido`/`data_revogacao` NESSE mesmo
registro (as únicas colunas que a role `authenticated` pode alterar depois
de criado, via `GRANT` por coluna — nem o dono edita tipo/forma/data
original). Sem policy de `DELETE`: a trilha de consentimento é permanente
por design. Decisão registrada com o usuário sobre revogação: bloqueia
coleta futura daquele tipo (`has_active_patient_consent`, security
definer) — nunca apaga dado já coletado sob consentimento válido; excluir
o que já existe seria uma ação separada e explícita, fora de escopo aqui.

**Bloco B (2026-09-19) — exames laboratoriais:** `lab_exams` +
`lab_reference_ranges` (catálogo global + customização pessoal por
profissional, mesmo padrão de `foods.is_global`) + `lab_markers`
(migrations 0020/0021). Faixa de referência sempre um SNAPSHOT no
resultado (nunca FK) — editar o catálogo depois não reinterpreta exame já
lançado (confirmado com script live). Busca cruza marcador + sexo do
paciente + idade; quando o sexo é `outro`/não informado, o sistema nunca
escolhe sozinho — mostra as duas opções (mesmo cuidado do cálculo de
gasto energético). Upload bloqueado sem consentimento ativo tipo
`exames`. Catálogo de 20 marcadores revisado linha a linha com o usuário
(nutricionista) antes de aplicar no banco. Vocabulário deliberadamente
neutro: "fora da faixa de referência", nunca rótulos interpretativos.
Iteração pós-uso: campo de marcador virou busca com lista clicável do
catálogo (era texto livre); tela de exames virou um MENU com duas opções
totalmente independentes — "Anexar PDF" e "Preencher marcadores" — cada
uma abrindo uma tela só daquilo; um exame criado do lado do arquivo
sempre nasce COM o arquivo (upload+registro num único passo, com rollback
se falhar) e nunca aparece do lado dos marcadores, e vice-versa
(filtrado por `arquivo_path`, sem coluna nova).

**Bloco C (2026-09-19) — evolução fotográfica, RISCO ALTO:** `patient_photos`
em bucket **separado** (`fotos-evolucao`, não reaproveita o bucket
`profissional` da Fase 2) — migrations 0022/0023. A garantia de
consentimento aqui é mais forte que em exames: a própria política de
`INSERT` do banco chama `has_active_patient_consent()` no `WITH CHECK` —
mesmo um bug na Server Action não abriria brecha, o Postgres rejeita o
INSERT sozinho. Componente de upload literalmente não renderiza sem
consentimento ativo (nem botão desabilitado — ausência mesmo). URLs
assinadas de 15 minutos (mais curtas que exames, por ser dado mais
sensível), nunca armazenadas nem cacheadas. Exclusão remove o arquivo do
storage **de verdade** antes de marcar a linha como excluída (ordem
importa: se a remoção do storage falhar, a linha não é marcada, para o
sistema nunca "mentir" que a foto sumiu enquanto o arquivo ainda existe).
Todo acesso (gerar a URL assinada) grava em `audit_log` quem visualizou e
quando — `audit_log.acao` ganhou o valor `view` (antes só
insert/update/delete). Aba própria "Evolução Fotográfica" (pedido do
usuário — inicialmente ficou dentro da aba "Evolução", mas photos e
antropometria são conceitos distintos o bastante pra abas separadas).

### Testes obrigatórios do Bloco C (RISCO ALTO) — todos passaram
Script live `scripts/test-patient-photos-isolation.mjs`
(`npm run test:patient-photos-isolation`): profissional B não acessa foto
de A por caminho direto (download/URL assinada) nem lista a pasta de A;
URL assinada expirada deixa de funcionar; exclusão remove o arquivo do
storage de verdade (confirmado via `admin.storage.download` falhando
depois); upload sem consentimento é rejeitado pela própria policy do
banco (código `42501`), não só pela aplicação.

### Critérios de aceite
- [x] Faixa de referência de exame correta por sexo/idade, sem o sistema decidir sozinho quando o sexo é ambíguo.
- [x] Editar catálogo global de exames não reinterpreta resultado já lançado.
- [x] Upload de exame e de foto bloqueados de verdade sem consentimento ativo (foto: garantido também na policy do banco).
- [x] Exclusão de foto remove o arquivo do storage, não só a linha.
- [x] URLs de exame (1h) e de foto (15min) sempre assinadas, nunca permanentes; expiração testada ao vivo.
- [x] Isolamento entre profissionais (exames e fotos) testado ao vivo com contas descartáveis.
- [x] Acesso a foto registrado em auditoria (quem, quando).

### Riscos (mitigado)
Foto de paciente é dado sensível — mitigado com bucket separado, RLS
exigindo consentimento ativo na própria policy de INSERT (não só na
aplicação), URLs de 15min nunca cacheadas, exclusão física do arquivo, e
trilha de auditoria de acesso. Os 5 testes obrigatórios do bloco (item de
maior risco da fase) rodaram contra o projeto real e todos passaram —
nenhuma verificação que deveria falhar passou.

---

## PHASE 8 — Área do paciente · `ADIADA` · `HIGH` (V2)

**Dependências:** decisão de identidade do paciente (Fase 1) + Fases 4 e 5.

```
[ ] Modelo de autenticação do paciente (convite por link/e-mail)
[ ] Migration: patient_users, vínculo com patients
[ ] RLS: paciente vê apenas os próprios dados
[ ] Layout mobile-first separado
[ ] Visualizar plano, receitas, documentos
[ ] Registro diário (refeições, água)
[ ] Próxima consulta
```

**Adiada em 2026-09-19, reafirmando a decisão D2** (`docs/DECISIONS.md`):
o nutricionista já consegue entregar plano/receitas ao paciente hoje sem
nenhuma segunda superfície de autenticação (PDF + link assinado por
WhatsApp, Fase 4) — abrir login de paciente é risco real (vazar dado
clínico entre pacientes) por um ganho que já existe de outra forma. Não
implementado, nenhuma migration escrita — retomar é aditivo (não exige
desfazer nada) se/quando fizer sentido reabrir D2. Pular direto para a
Fase 9 enquanto isso.

**Em 2026-09-20, ganhou um substituto parcial: a "Central de Envio"**
(decisão D6, `docs/DECISIONS.md`) — um diálogo no cabeçalho do perfil do
paciente (ao lado de "Exportar dados"/"Editar dados") com seleção por
checkbox: Plano Alimentar, Evolução Física, Impressos (qualquer receita +
PDFs avulsos), Lembrete de consulta e Mensagem livre — tudo pronto pra
mandar por WhatsApp num só lugar. Evolução Física e Impressos vão como PDF
de verdade (`document_share_tokens`, migration 0024, generaliza o link
assinado do plano da Fase 4 pra qualquer tipo de documento). Não é a Fase 8
nem a substitui de verdade (sem conta de paciente, sem histórico do que foi
enviado) — só fecha a lacuna prática enquanto D2 continuar valendo.

**Risco:** é uma segunda superfície de autenticação e autorização. Erro de RLS aqui expõe dado clínico ao paciente errado. Exige revisão de segurança dedicada.

---

## PHASE 9 — Financeiro · `DONE` · `MEDIUM` (V2)

**Objetivo:** ajudar o profissional a entender o consultório e a pensar no preço da consulta.
**Escopo:** NÃO é um ERP — sem centro de custo, rateio contábil, conciliação bancária, DRE ou
plano de contas.

**Dependências:** Fase 4 (identidade do profissional, para o recibo).

### Tarefas

```
[x] Migration 0025: expenses (despesas do consultório)
[x] Migration 0025: patient_billings (o acordo de cobrança com o paciente)
[x] Migration 0025: payments (parcelas/recebimentos, "pendente" derivado)
[x] src/lib/finance.ts: normalizeToMonthly, monthlyFixedCost, costPerAppointment, splitInstallments
[x] Testes de finance.ts (recorrências, despesa única/inativa, divisão por zero, precisão decimal)
[x] Server Actions de CRUD das três tabelas
[x] Bloco B — UI: página /financeiro com despesas e custo do consultório
[x] Bloco C — aba Financeiro no paciente: cobrança (avulso/pacote), lista de pagamentos,
    dar baixa, total recebido/em aberto
[x] Bloco C — Recibo em PDF com identidade profissional (reaproveita @react-pdf/renderer, Fase 4)
[x] Bloco C — envio do recibo pela Central de Envio (WhatsApp)
[x] Bloco C — dashboard: recebido no mês, pendente, ticket médio, despesas a vencer
[x] Bloco C — página Financeiro: painéis "Pendente por paciente" e "Recebido no mês por
    paciente" (pós-uso, 20/09/2026), abaixo da lista de despesas, com scroll próprio
[x] Bloco D — Status financeiro no agendamento (não pago/pagou sinal/pagou integral/
    gratuito), criando/atualizando patient_billings/payments por baixo (pós-fechamento);
    campo obrigatório, e travado quando a consulta já pertence a um pacote
[x] Bloco E — "Novo pacote" na Agenda: agenda N consultas de uma vez (datas/horários
    individuais), com uma cobrança de pacote em comum (1 cobrança única, exceto "pagou
    sinal" que gera sinal + restante)
[x] Correções pós-uso (21/09/2026) — excluir consulta cancela a cobrança pendente ligada
    a ela (avulsa ou pacote), sempre perguntando antes se há valor já pago; cancelamento
    parcial de pacote oferece cobrar só a parte realizada ou excluir tudo; cobranças
    pendentes editáveis/excluíveis na aba Financeiro do paciente
```

**Bloco A (2026-09-20) — backend:** migration `0025_finance.sql`. Três tabelas, mesmo
padrão de soft delete + RLS desde a 0005: `expenses` (despesa do consultório, com
`recorrencia` e normalização para base mensal), `patient_billings` (o ACORDO de cobrança
com o paciente — avulso ou pacote, nunca a parcela em si) e `payments` (as parcelas desse
acordo). "Pendente" é **derivado** de `data_pagamento is null`, nunca uma coluna de status
própria — mesmo princípio já usado no projeto para evitar um campo que possa ficar
dessincronizado do dado real. Todo valor é `numeric(10,2)`, nunca float. Seguindo o
aprendizado da Fase 6 (bug sistêmico de RLS), as três exclusões lógicas já nasceram como
funções `security definer` (`soft_delete_expense`/`soft_delete_patient_billing`/
`soft_delete_payment`), sem passar pelo bug da migration 0017.

`src/lib/finance.ts` centraliza todo o cálculo monetário — `normalizeToMonthly` (mensal =
valor, trimestral = valor/3, semestral = valor/6, anual = valor/12, única = 0, nunca entra
no custo fixo recorrente), `monthlyFixedCost` (soma das despesas ativas normalizadas),
`costPerAppointment` (custo mensal ÷ atendimentos/mês, com guarda contra divisão por zero)
e `splitInstallments` (divide o valor de um pacote em N parcelas sem deixar sobra por
arredondamento independente). Todas operam em **centavos internamente** — nunca somando
reais em ponto flutuante — convertendo de volta para reais só no retorno. 18 testes novos
em `finance.test.ts`, incluindo o caso de precisão decimal pedido (somar 0.1 + 0.2 três
vezes dá exatamente 0.90, não `0.9000000000000001`).

Server Actions (`src/lib/actions/finance.ts`) cobrem CRUD das três tabelas. Criar uma
`patient_billing` já gera as `payments` correspondentes na mesma chamada (avulso = 1
parcela; pacote = N parcelas via `splitInstallments`, vencendo uma por mês a partir de
`data_inicio`) — se a geração das parcelas falhar, a cobrança recém-criada é desfeita via
`soft_delete_patient_billing` para não deixar uma cobrança "fantasma" sem parcela nenhuma.
Edição de `patient_billing` depois de criada é restrita a `descricao`/`data_inicio` — mudar
`valor_total`/`tipo`/`numero_consultas` deixaria as parcelas já geradas dessincronizadas do
acordo; trocar o valor de um pacote já cobrado é uma cobrança nova, não uma edição.
`npm test` (156/156) e `npm run build` passam.

**Limite conhecido, a revisitar em bloco futuro se necessário:** excluir uma
`patient_billing` (soft delete) não excomunga em cascata as `payments` associadas — elas
continuam visíveis por consulta direta à tabela `payments`, mesmo com a cobrança "pai" já
invisível. Não é um problema de segurança (RLS por `user_id` continua valendo), mas pode
exigir tratamento quando a UI de cobrança/pagamentos for construída.

**Bloco B (2026-09-20) — UI de despesas e custo do consultório:** página `/financeiro`
(nova entrada "Financeiro" na navegação lateral), com duas seções lado a lado. Despesas:
cadastro rápido (`ExpenseFormDialog`) com a recorrência em destaque como abas (não um
`<select>` escondido), campo condicional — dia do mês para recorrentes, data completa para
'única' — e listagem (`ExpensesTable`) com descrição, categoria, valor, recorrência e
próximo vencimento; encerrar/reativar uma despesa recorrente mexe só em `ativa`
(`setExpenseActive`, nova action), nunca em `deleted_at`. Custo do consultório
(`CustoConsultorioCard`): custo fixo mensal, quebra por categoria (barra proporcional) e
custo por atendimento, com simulação ao vivo — o campo de atendimentos/mês parte de uma
sugestão (média dos últimos 3 meses de `appointments` com `status = 'realizado'`, nova
`averageMonthlyAppointments`) mas é livremente editável, recalculando na hora
(`costPerAppointment`, já existente do Bloco A). Cuidado deliberado de vocabulário: a tela
nunca chama esse número de "preço sugerido" — só "custo por atendimento", com uma nota
fixa explicando que não inclui lucro, imposto nem custo variável, e que cobrar exatamente
esse valor é trabalhar de graça.

Duas funções novas em `finance.ts`, ambas puras e testadas: `monthlyFixedCostByCategory`
(mesma soma em centavos de `monthlyFixedCost`, agrupada por categoria) e `nextDueDate`
(ver correção abaixo — a primeira versão inferia o mês de recorrência a partir de
`created_at`, substituída ainda no mesmo dia). Formatação monetária centralizada em
`formatCurrencyBRL` (pt-BR, "R$ 1.234,56"). Estados de loading/vazio/erro seguem o padrão
já usado em `/receitas`: loading fica a cargo do `(app)/loading.tsx` compartilhado (Server
Component, sem loading próprio da rota), erro de query é exibido inline, e o vazio usa
`EmptyState`.

**Correções pós-uso, ainda em 2026-09-20 (a partir do teste real do usuário):**

1. **Migration 0026** — bug de nomes de constraint: `patient_billings_numero_consultas_check`
   e `payments_forma_pagamento_check` (migration 0025) colidiam com o nome que o Postgres
   gera sozinho para o CHECK inline da própria coluna (`<tabela>_<coluna>_check`), causando
   `ERROR 42710: already exists` na primeira execução real no SQL Editor — não era um
   problema de reexecução, o erro acontecia na primeira vez em qualquer banco. Renomeados
   para `patient_billings_tipo_consultas_check` e `payments_pagamento_consistente_check`.
   **Lição registrada na memória do projeto:** nunca nomear uma constraint de tabela igual
   ao padrão `<tabela>_<coluna>_check` de uma coluna que já tem CHECK inline.

2. **Migration 0026** também trocou o modelo de "próximo vencimento": trimestral/semestral/
   anual passaram a guardar `mes_vencimento` (1-12) explícito, em vez de inferir o mês pelo
   `created_at` (pedido do usuário — o mês real do ciclo é uma decisão do profissional, não
   algo dedutível). Como os intervalos (3/6/12) sempre dividem 12 igualmente, os meses de
   vencimento caem sempre nos mesmos meses todo ano (ex.: mês 3 + trimestral = mar/jun/set/
   dez) — `nextDueDate` e a nova `occurrenceDateInMonth` usam só a fase (`mes_vencimento mod
   intervalo`), sem precisar de uma data de início. `dia_vencimento` continua existindo só
   para mensal/trimestral/semestral/anual; `data_vencimento` só para 'unica'.

3. **Migration 0027** — dois pedidos novos do usuário: (a) etiqueta informativa
   `parcelamento` ("à vista"/"parcelado", só para trimestral/semestral/anual) — não divide
   valor nem gera parcelas de verdade, é só lembrete; (b) tabela `expense_occurrences`,
   equivalente de `payments` mas para despesas do consultório — cada vencimento real vira
   uma linha, "pendente" derivado de `data_pagamento is null` (mesmo princípio de sempre).
   Sem job agendado neste projeto: a ocorrência do mês vigente de cada despesa recorrente
   ativa é garantida (`ensureCurrentMonthExpenseOccurrences`, upsert idempotente) toda vez
   que `/financeiro` carrega; despesa 'unica' já nasce com sua única ocorrência na criação.
   Base explícita para um futuro card "Despesas do mês" no dashboard (ainda não construído
   — só a captura de dados começou agora). UI: coluna "Este mês" na tabela de despesas
   (badge Pago/Pendente + `RegisterExpenseOccurrenceDialog` para dar baixa, ou desfazer).

4. **Sem migration nova** — troca de UX pedida pelo usuário: removido o botão "Encerrar/
   Reativar" (toggle de `ativa`), substituído por **editar** e **excluir de verdade**.
   `ExpenseFormDialog` ganhou modo de edição (prop `expense`, mesmo padrão de
   `NewAssessmentDialog`/`FoodFormDialog`) com trigger customizável (usado como item de
   dropdown na tabela, não só o botão "Nova despesa"). `deleteExpense` deixou de chamar a
   função `security definer` de soft delete e passou a fazer `DELETE` de verdade — decisão
   explícita do usuário: "ao excluir, ela simplesmente some", sem exigir um passo de
   "encerrar" antes nem preservar histórico da exclusão (diferente de paciente/avaliação/
   plano, que são dados clínicos). `expense_occurrences` some junto via `on delete cascade`.
   Editar uma despesa 'unica' também atualiza sua única ocorrência (valor/vencimento) para
   não ficar dessincronizada — despesas recorrentes não sincronizam ocorrências já geradas
   retroativamente (só as futuras nascem com o novo agendamento), simplificação deliberada
   já que o pedido foi "não precisa ter essa ação no histórico". Exclusão pede confirmação
   simples (`AlertDialog`, sem digitar "excluir" — despesa não é dado clínico de alto risco
   como paciente). A função `soft_delete_expense` (migration 0025) fica sem uso, mas não foi
   removida do banco — não valia uma 4ª migration na mesma noite só por limpeza.

5. **Sem migration nova** — pagar adiantado: o usuário notou que pagar a parcela atual não
   liberava a próxima antes do mês dela chegar (ex.: aluguel mensal vence dia 10, pagar dia
   20 do mês anterior devia já mostrar o vencimento seguinte, não o mesmo). Trocado o modelo
   de geração de `expense_occurrences`: em vez de "uma ocorrência por mês calendário"
   (`ensureCurrentMonthExpenseOccurrences`), agora é "no máximo uma parcela PENDENTE por vez"
   (`ensureNextExpenseOccurrences`) — pagar a atual (mesmo antes do mês dela chegar) libera a
   seguinte na hora (`advanceOneOccurrence`, sempre um ciclo à frente, mesmo dia,
   respeitando o último dia do mês). Duas colunas antigas ("Próximo vencimento", calculado só
   pelo calendário, e "Este mês", pela ocorrência do mês corrente) viraram uma só: **"Próxima
   parcela"** — sempre a ocorrência de maior `data_vencimento` já registrada para aquela
   despesa (`latestOccurrencePerExpense`). Desfazer um pagamento também desfaz o avanço que
   ele causou: remove a parcela seguinte se ainda não foi paga (só existiria por causa
   daquele pagamento) — se o profissional já tiver adiantado duas, desfazer a primeira não
   apaga a segunda, que é histórico real. `nextDueDate`/`occurrenceDateInMonth` continuam no
   código (ainda corretos, só não usados nesta tabela) — podem servir uma futura visão de
   calendário. 10 testes novos (`advanceOneOccurrence`, `firstOccurrenceOnOrAfter`,
   `latestOccurrencePerExpense`).

46 testes em `finance.test.ts` ao final do dia. `npm test` (184/184), `npm run build` e
`npm run lint` passam.

**Bloco C (2026-09-20) — cobrança de paciente, Recibo e dashboard. Fecha a Fase 9.**

**1. Aba Financeiro no paciente** (`PatientFinancePanel`, nova):
- `NewPatientBillingDialog` — primeiro pergunta o tipo (abas Avulso/Pacote, mesmo padrão de
  `ExpenseFormDialog`) e adapta o formulário: avulso pede só descrição/valor/vencimento;
  pacote soma descrição, valor total, número de consultas e "como será pago" (à vista ou N
  parcelas). Reaproveita `createPatientBilling` (já existia desde o Bloco A) sem nenhuma
  mudança de contrato — só a UI era nova.
- Lista de pagamentos em duas seções, Pendentes e Pagos, com total Recebido/Em aberto no
  topo (`sumCurrency`, nova em `finance.ts`, mesmo cuidado de centavos de sempre).
- `RegisterPatientPaymentDialog` dá baixa (`registerPayment`, já existia) pedindo data +
  forma de pagamento juntas; "Desfazer" volta pra pendente (`unregisterPayment`, idem).
- **Correção de bug real ao extrair a lógica pra teste:** `createPatientBilling` calculava a
  data de cada parcela com `Date.setMonth()` a partir de um `Date` local — isso quebra pra
  início em dia 29/30/31 (`setMonth` "rola" pro mês seguinte em vez de limitar ao último dia
  do mês, ex.: 31/01 + 1 mês vira 02 ou 03/03, não 28/02) e também tinha o mesmo risco de
  fuso de sempre (`Date` local → `toISOString()` UTC). Extraído para
  `buildInstallmentPayments` (puro, testado, aritmética só em ano/mês/dia inteiros em UTC) —
  bug nunca esteve visível na prática (nenhum pacote com início em dia 29-31 foi criado
  ainda), mas existia desde o Bloco A.

**2. Recibo** — reaproveita 100% a infraestrutura de PDF da Fase 4
(`@react-pdf/renderer`, `buildProfissionalPdfHeaderData`), nenhuma biblioteca nova:
`recibo-pdf-data.ts` (view-model puro) + `recibo-pdf-document.tsx` (visual, mesmo padrão de
header/logo dos outros três documentos — duplicado, não extraído, seguindo a convenção já
estabelecida no projeto) + `generate-recibo-pdf.ts` (orquestrador). Conteúdo: logo, nome,
CRN e dados do profissional, nome do paciente, valor em algarismos (`formatCurrencyBRL`) e
por extenso, descrição, data do pagamento, espaço de assinatura (imagem, se cadastrada, mais
uma linha com nome e CRN abaixo — sempre presente, mesmo sem assinatura digital). Só gera
recibo de pagamento **já recebido** (`data_pagamento` preenchido) — pagamento pendente não
tem o que recibar. **Vocabulário:** documento chamado só de "Recibo" em todo lugar — nenhuma
menção a "nota fiscal"/"NFS-e"/"fatura", e sem numeração sequencial (isso sugeriria um
documento fiscal, que este não é e não substitui).

`valorPorExtenso` (`src/lib/pdf/valor-extenso.ts`, módulo próprio — é formatação de texto,
não cálculo financeiro, não pertence a `finance.ts`) converte reais para português por
extenso, com os casos difíceis testados: singular ("um real", "um centavo"), valores
redondos (nunca menciona centavos), centenas (inclusive o caso especial "cem" vs. "cento"),
milhares, e (bônus, não pedido) milhões com a regra de "de reais". 24 testes.

**3. Envio pela Central de Envio** — `document_share_tokens` ganhou o tipo `'recibo'`
(migration `0028`, só altera o `CHECK` da coluna `tipo`, sem tabela/bucket/função nova — o
mesmo desenho genérico da migration 0024 já suportava isso). `createReciboShareLink` segue
exatamente o padrão de `createAntropometriaShareLink`/`createReceitaShareLink` (dedup por
`referencia_id`, upload no bucket `documentos`, link assinado de 90 dias). Novo item "Recibo
de pagamento" na Central de Envio (`ReciboCard`), com um `Select` listando só os pagamentos
já recebidos do paciente (`SendCenterContext.pagamentosRecebidos`, nova). Mensagem combinada
(`buildMensagemCombinada`) ganhou o parágrafo do recibo quando selecionado.

**4. Dashboard** — quatro cards novos, todos levando a `/financeiro` (não existe hoje uma
tela só de pagamentos de todos os pacientes — os pagamentos em si vivem na aba Financeiro de
cada paciente; `/financeiro` é o destino mais próximo do "aqui" dessas métricas):
- **Recebido no mês** — soma de `payments.valor` com `data_pagamento` no mês corrente.
- **Pendente** — soma de `payments.valor` com `data_pagamento is null`, de todos os
  pacientes (sem recorte de período — é "quanto falta receber", não "quanto venceu").
- **Ticket médio** — **decisão registrada, conforme pedido:** numerador é o recebido no mês
  (acima); denominador é o **número de consultas com `status = 'realizado'` no mês**, não o
  número de pacientes distintos atendidos. Um mesmo paciente pode ter mais de um atendimento
  no mês, e "ticket médio" aqui responde "quanto entra, em média, por sessão" — a mesma
  unidade (por atendimento) já usada em "custo por atendimento" em `/financeiro`. Se a
  intenção fosse "quanto cada paciente ativo deixa, em média", o denominador certo seria
  pacientes distintos — número diferente, pergunta diferente. Ambos são válidos; este é o
  que está na tela.
- **Despesas a vencer (30 dias)** — soma e contagem de `expense_occurrences` com
  `data_pagamento is null` e vencimento até 30 dias à frente, **incluindo as já vencidas**
  (sem piso na data, só teto) — pedido explícito era "próximos 30 dias + vencidas".

**5. Testes:**
- `sumCurrency` (nova, `finance.ts`) — soma bate com soma manual, testado inclusive com o
  mesmo caso de precisão decimal do resto do módulo.
- `buildInstallmentPayments` — número certo de parcelas, soma bate com o valor total mesmo
  com resto de centavos, vencimento correto atravessando virada de ano e dia 31 em mês mais
  curto (o bug descrito no item 1, agora coberto).
- `valorPorExtenso` — os 4 casos pedidos (centavos, redondos, singular, centenas) mais
  milhares, todos com asserção exata de string.
- Isolamento entre profissionais: `scripts/test-finance-patient-isolation.mjs` (novo,
  `npm run test:finance-patient-isolation`), mesmo padrão de contas descartáveis dos scripts
  anteriores — confirma que `patient_billings`/`payments` de um profissional não são
  visíveis nem editáveis por outro (select vazio, update 0 linhas, RPC de exclusão retorna
  `false`). **Executado em 2026-09-20 contra o projeto Supabase real — 6/6 passaram,
  nenhum vazamento encontrado.** Contas de teste descartáveis criadas e removidas
  automaticamente ao final.

64 testes novos nesta sessão inteira de Fase 9 (18 Bloco A + 18 correções pós-uso do Bloco B
+ 28 do Bloco C: 3 `sumCurrency` + 5 `buildInstallmentPayments` + 24 `valorPorExtenso`... — a
soma exata está no `npm test` abaixo, não recontada manualmente aqui). `npm test` (219/219),
`npm run build` e `npm run lint` passam.

### Critérios de aceite
- [x] Custo fixo mensal soma corretamente despesas de qualquer recorrência, ignorando
      inativas e "única".
- [x] Nenhuma soma monetária sofre erro de arredondamento de ponto flutuante (testado).
- [x] Sugestão de atendimentos/mês vem da média real dos últimos 3 meses, não de um chute,
      e é livremente sobrescrevível para simular outro cenário.
- [x] A tela nunca chama o custo por atendimento de "preço sugerido"/"quanto cobrar", e
      deixa explícito que o valor não inclui lucro, imposto nem custo variável.
- [x] Mês de vencimento de despesa trimestral/semestral/anual é uma escolha explícita do
      profissional, não uma inferência do sistema.
- [x] Dar baixa numa ocorrência de despesa reflete imediatamente o status "Pago"/"Pendente"
      na tela, com histórico preservado.
- [x] Dar baixa num pagamento de paciente reflete imediatamente em "pendentes"/"pagos" na
      aba Financeiro do paciente.
- [x] Recibo sai com identidade profissional (logo, nome, CRN), valor em algarismos e por
      extenso, e nunca menciona nota fiscal/NFS-e/fatura nem tem numeração sequencial.
- [x] Card de despesas a vencer no dashboard, agregando `expense_occurrences` (30 dias +
      vencidas).
- [x] Ticket médio no dashboard, com o denominador (consultas realizadas, não pacientes
      distintos) documentado e justificado.
- [x] Isolamento financeiro entre profissionais testado ao vivo — `npm run
      test:finance-patient-isolation`, executado em 2026-09-20, **6/6 passaram** (nenhum
      vazamento encontrado).
- [~] "Visão mensal" genérica (receitas e despesas do período lado a lado, tipo um relatório
      fechado do mês) não foi construída como tela própria — as peças (recebido no mês,
      pendente, despesas a vencer) já estão no dashboard, mas não há uma tela dedicada de
      fechamento mensal. Não foi pedida explicitamente no Bloco C; registrada aqui como
      lacuna conhecida caso vire pedido futuro.
- [x] Status financeiro do agendamento (Bloco D) reflete corretamente em Pendente/Recebido
      em todos os lugares (aba do paciente, dashboard, página Financeiro), sem lógica
      duplicada — só cria/substitui `patient_billings`/`payments` já existentes.
- [x] "Gratuito" e "nunca definido" são distinguíveis ao reabrir um agendamento pra editar
      (`appointments.status_financeiro`), mesmo nenhum dos dois gerando `payment` nenhum.

### Riscos (mitigado)
Cálculo monetário incorreto é o pior tipo de bug num módulo financeiro — silencioso e só
percebido no fechamento do mês. Mitigado centralizando 100% da matemática em
`src/lib/finance.ts` (nunca duplicada em componente) e operando em centavos internamente. O
bug real encontrado no Bloco C (`Date.setMonth()` quebrando parcelas com início em dia
29-31) reforça esse princípio: ele só foi encontrado porque a lógica foi extraída pra uma
função pura e testável — outro motivo pra nunca deixar cálculo de data/dinheiro solto dentro
de uma Server Action sem teste.

**Bloco D (2026-09-20, pós-fechamento) — Status financeiro no agendamento.** Pedido do
usuário depois de já ter fechado a fase: ao agendar/editar uma consulta na Agenda, um campo
"Status financeiro" (inicialmente opcional, depois tornado **obrigatório** a pedido do
usuário — ver ajuste de UX abaixo) com 4 opções — **não pago** (digita o valor da consulta,
vira pendente), **pagou sinal** (digita valor + data + forma do sinal recebido, e quanto
falta + vencimento do restante — dois lançamentos, um pago e um pendente), **pagou
integral** (digita valor + data + forma de pagamento) e **gratuito** (nenhum lançamento).

Decisão de arquitetura: nenhuma tabela nova. Por baixo, isso cria/substitui uma
`patient_billings` avulsa (nova coluna `appointment_id`, migration `0029`) com seus
`payments` — as MESMAS tabelas que a aba Financeiro do paciente, o dashboard e a página
Financeiro já leem. É por isso que um agendamento marcado "não pago" já aparece certo em
Pendente em todo lugar, sem nenhuma lógica nova nesses três lugares. Trocar o status depois
(reabrir o agendamento e mudar de "pagou sinal" pra "não pago", por exemplo) sempre
**substitui** a cobrança anterior (soft delete da antiga + criação de uma nova) em vez de
tentar reconciliar formatos diferentes — mais simples e robusto, dado que são no máximo 2
linhas.

`appointments.status_financeiro` (mesma migration) existe só por um motivo: como não dá pra
gravar um `payment` de valor R$0 (constraint `valor > 0` desde a 0025), "gratuito" não deixa
nenhum rastro em `payments` — sem essa coluna, "gratuito" e "nunca definido" seriam
indistinguíveis ao reabrir o agendamento pra editar. Para os outros 3 status, essa coluna é
só um espelho de conveniência; o valor de verdade mora nos `payments`.

Função pura nova `deriveAppointmentBillingState` (`finance.ts`) reconstrói o que mostrar no
formulário a partir dos payments já salvos — 5 testes cobrindo os 3 formatos válidos e o
caso "formato inesperado não quebra, só retorna não-definido". `createAppointment` passou a
devolver o `id` da consulta criada (precisava disso pra já ligar o status financeiro numa
consulta nova, não só ao editar uma existente). Centralizado `FORMA_PAGAMENTO_LABELS` em
`validations/finance.ts` (estava duplicado em 3 componentes; virou 1).

225 testes no total. `npm test`, `npm run build` e `npm run lint` passam.

**Ajustes de UX no Bloco D (mesmo dia):** (1) removido o painel de contexto clínico
(última consulta/avaliação/plano/pendências) que ficava entre "Paciente" e "Data" no
formulário de agendamento — o `context` continua sendo buscado (o botão "Lembrete
WhatsApp" ainda precisa do telefone do paciente), só parou de ser exibido; (2) formulário
alargado (`sm:max-w-2xl`) e reorganizado em duas colunas — esquerda com Data/Início-
Término/Tipo/Status, direita com o Status financeiro inteiro, separadas por uma linha
vertical — em vez de tudo empilhado numa coluna só; (3) "Status financeiro" virou
**obrigatório** (rótulo trocou de "(opcional)" pra `*`, e `handleSubmit` barra o envio sem
uma escolha) — pedido explícito do usuário, não uma decisão técnica.

**Bloco E (2026-09-20, mesmo dia) — "Novo pacote" na Agenda.** Botão ao lado de "Nova
consulta" que abre um formulário para agendar **N consultas de uma vez**, com uma cobrança
de pacote em comum. Diferente do formulário de consulta avulsa: em vez de uma Data/Início/
Término únicos, uma lista dinâmica (uma linha por consulta, que cresce/encolhe com o campo
"Número de consultas") com Data + Início + Término individuais de cada uma. Status
financeiro adaptado pro pacote, na primeira versão: "não pago" e "pagou integral" sempre
dividiam o valor total em uma parcela por consulta, e "pagou sinal" dividia o restante pelas
datas das consultas. **Revertido no mesmo dia**, ver "Correções pós-uso" abaixo — pacote
passou a gerar uma cobrança única.

Decisão de arquitetura: nenhuma tabela nova, de novo. `patient_billings.appointment_id`
(Bloco D, migration 0029) é 1:1 — serve só pra consulta avulsa. Um pacote é o oposto (N
consultas : 1 cobrança), então a FK precisou ir no sentido inverso:
`appointments.patient_billing_id` (nova, migration `0030`), muitas consultas apontando pra
uma cobrança só. `setPackageBillingStatus` (nova Server Action) cria a cobrança + os
`payments` e liga as N consultas a ela.

A criação das N consultas reaproveita `createAppointment` chamado N vezes em sequência, uma
por linha — herda de graça a checagem de conflito de horário que já existia lá, sem
duplicar lógica. Se qualquer consulta falhar no meio do caminho (ex.: conflito de horário),
ou se salvar o status financeiro falhar depois, tudo que já tinha sido criado é desfeito
(soft delete) — nunca fica um pacote pela metade.

**Decisão tomada com o usuário sobre o formulário normal de editar consulta:** se uma
consulta que já pertence a um pacote for aberta ali (não pelo fluxo de "Novo pacote" — ex.:
só remarcar uma sessão), o campo Status financeiro fica **travado**, com um aviso ("Faz
parte de um pacote — use a aba Financeiro do paciente pra mexer no pagamento") em vez de
pedir uma escolha nova. Sem isso, editar uma consulta avulsa dentro de um pacote já pago
criaria uma cobrança avulsa conflitante, duplicada, por cima da cobrança do pacote — o
"Status financeiro obrigatório" do Bloco D exigiria isso a cada edição se não fosse essa
exceção.

6 testes novos (`buildPackageInstallments`, `subtractCurrency`). 231 testes no total.
`npm test`, `npm run build` e `npm run lint` passam.

**Correções pós-uso (21/09/2026) — cascata de cancelamento entre Agenda e Financeiro.**
Depois de usar os Blocos D e E de verdade, o usuário achou várias inconsistências entre
excluir uma consulta na Agenda e o que ficava (ou sumia) no Financeiro. Sequência de ajustes,
todos no mesmo dia:

1. **Excluir uma consulta cancela a cobrança pendente ligada a ela.** Antes, `deleteAppointment`
   só apagava a consulta — a `patient_billing`/`payments` ficavam órfãs, aparecendo em
   Pendente/Recebido sem nenhuma consulta por trás. Nova função `cancelAppointmentBilling`
   (`finance.ts`), chamada por `deleteAppointment` depois do soft delete: avulsa (1:1) cancela
   sempre; pacote (N:1) só cancela quando a ÚLTIMA consulta ligada a ele é excluída (as
   demais continuam agendadas normalmente).
2. **Pacote agora gera uma cobrança única, não uma parcela por consulta.** Revertendo a
   decisão original do Bloco E: na prática, quase todo pacote é pago de uma vez (à vista/
   cartão no ato de agendar), então dividir em N parcelas só gerava ruído em Pendentes.
   `buildPackageInstallments` foi removido (dead code); "não pago"/"pagou integral" geram 1
   `payment`; "pagou sinal" continua com 2 (sinal pago + restante), mas o vencimento do
   restante agora é uma única data digitada (`vencimentoFalta`), não mais uma por consulta.
3. **Excluir a última cobrança de um pacote pergunta antes de mexer nas consultas.** Diálogo
   "Deseja também cancelar as consultas deste pacote?" na aba Financeiro do paciente, com o
   mesmo cuidado da avulsa.
4. **Cancelamento parcial de pacote nunca decide sozinho o que fazer com o dinheiro.** Se
   pelo menos 1 consulta do pacote já foi realizada (ou faltou/foi cancelada) e sobram outras
   ainda agendadas, excluir a cobrança abre "Cancelamento parcial do pacote" com duas opções
   — **"Cobrar apenas a consulta realizada"** (cancela as consultas restantes e abre a edição
   do valor pra reduzir a cobrança) ou **"Excluir cobrança inteira"** (reembolso total) —
   nunca um "manter sem editar" (removido por ser inútil na prática, feedback do usuário).
   A edição do valor só cancela as consultas DEPOIS de salvar (`onSaved` no
   `EditPatientPaymentDialog`), nunca antes — bug corrigido no mesmo dia (cancelava ao abrir
   o formulário, mesmo se o usuário desistisse sem salvar).
5. **Cobranças pendentes viraram editáveis e excluíveis na aba Financeiro do paciente.**
   `updatePayment`/`deletePayment` já existiam desde o Bloco A mas nunca tinham sido ligadas a
   uma tela — agora cada linha pendente tem lápis (editar valor/vencimento/observações) e
   lixeira. Pacotes ganharam uma descrição clicável que abre um diálogo com as consultas
   vinculadas (data/horário/status) — segunda embed do Supabase com hint explícito de FK
   (`appointments!patient_billings_appointment_id_fkey` vs.
   `appointments!appointments_patient_billing_id_fkey`), necessário porque há duas relações
   distintas entre as tabelas.
6. **Excluir uma consulta já paga pergunta antes de apagar o pagamento.** Faltava o caso
   inverso do item 1: excluir uma consulta com valor JÁ RECEBIDO (avulsa "pagou sinal"/
   "pagou integral", ou a última consulta de um pacote com pagamento registrado) também
   cascateava e apagava o pagamento. Novo diálogo "Excluir consulta já paga" no formulário de
   edição da Agenda, com **"Manter o pagamento e excluir só a consulta"** ou **"Excluir
   consulta e pagamento juntos"**. `deleteAppointment` ganhou a opção `{ keepBilling: true }`
   pra pular a cascata; nova Server Action `getPackageDeletionImpact` verifica de antemão (via
   `useEffect` no diálogo) se a consulta é a última do pacote e se há algo pago, pra decidir
   se pergunta ou não. Testado manualmente ponta a ponta (paciente Rick Palopoli, pacote de 3
   consultas): desfazer pagamento → cancelamento parcial mantendo R$200 da consulta realizada
   → marcar como recebido de novo → excluir a consulta na Agenda mantendo o pagamento →
   R$200 continua em "Recebido no mês".

Layout: o diálogo de decisão (3 botões em cenário parcial, 2 no de consulta já paga) tinha o
mesmo bug em ambos os lugares — texto/botões cortados no `max-w-md` padrão do `AlertDialog`.
Corrigido igual nos dois: `sm:max-w-lg` + botões empilhados verticalmente em vez do
`AlertDialogFooter` padrão (que só funciona bem com 1-2 botões).

227 testes no total (net: -4 depois de remover os testes de `buildPackageInstallments`).
`npm test`, `npm run build` e `npm run lint` passam.

### Próximo passo
Fase 9 fecha aqui (com os Blocos D e E incorporados). Próxima da lista (`Ordem
recomendada`, abaixo): **Fase 10 — Biblioteca e comunidade**, mas essa tem dependência
explícita de "base de usuários ativa" — vale confirmar com o usuário se já faz sentido
começar, ou se é hora de uma pausa pra validar o financeiro com nutricionistas reais antes
de abrir uma fase nova (mesmo espírito do gate que fechou o MVP na Fase 4).

---

## PHASE 10 — Biblioteca e comunidade · Biblioteca pessoal: `DONE` · Comunidade: `ADIADA` · `LOW` (V2/V3)

**Dependências (comunidade):** base de usuários ativa. **Não iniciar antes disso.**

**Escopo executado em 2026-09-21:** só a biblioteca PESSOAL do profissional — materiais de
orientação/educação que ele escreve ou envia, reutilizáveis para quantos pacientes precisar.
Comunidade e compartilhamento entre profissionais ficam adiados, pelo mesmo motivo já registrado
antes de abrir a fase: só fazem sentido depois de existir uma base de usuários ativa usando o
produto — abrir a superfície de compartilhamento/anonimização agora seria risco de LGPD sem
benefício, já que não há com quem compartilhar ainda.

```
[x] Migration 0031: library_materials (tipo, conteudo XOR arquivo_path, tags, visibilidade,
    deleted_at) + soft_delete_library_material (security definer, mesmo padrão da 0017)
[x] Página /biblioteca: listagem, busca por título, filtro por tipo e por tag, paginação
[x] Criar material escrevendo direto (editor de texto simples) ou enviando arquivo
    (PDF/imagem, bucket privado 'profissional' da Fase 2, pasta "biblioteca")
[x] Enviar material para um paciente pela Central de Envio (reutilizável — escrito uma vez,
    enviado a vários pacientes), com busca por título e por tag
[x] Estados de loading, vazio e erro no padrão do projeto (loading.tsx compartilhado,
    EmptyState com e sem filtro ativo, erro de query inline)
[ ] Biblioteca oficial/comunitária — ADIADA
[ ] Compartilhar receita/alimento entre profissionais — ADIADA
[ ] "Adicionar à minha biblioteca" (referência, sem duplicar) — ADIADA
[ ] Anonimização automática de casos clínicos — ADIADA
[ ] Moderação e denúncia — ADIADA
[ ] Feed de discussões — ADIADA
[x] Migration 0033: tabela feedback (identificado, RLS mínima sem policy de admin)
[x] Canal de feedback (item "Enviar feedback" no menu do usuário) com contexto automático
    (rota/user_agent/viewport), aviso de privacidade e confirmação humana — construído no
    lugar da comunidade, como preparação para os primeiros usuários
```

**Biblioteca pessoal (2026-09-21):** `library_materials` segue exatamente o padrão de soft
delete do projeto (`deleted_at is null` na policy de SELECT + função `security definer` pra
excluir, mesmo bug/correção da migration 0017 — sem isso, o soft delete falharia com "new row
violates row-level security policy"). Um material nasce de UMA das duas formas — `conteudo`
(escrito no editor de texto simples da tela) ou `arquivo_path` (PDF/imagem) — nunca as duas,
nunca nenhuma, via CHECK `library_materials_conteudo_xor_arquivo` (mesmo espírito do
`food_id`/`recipe_id` mutuamente exclusivos em `meal_items`). `visibilidade` só aceita
`'privado'` por ora (CHECK de um valor só) — o campo já existe pra que uma futura Fase de
comunidade seja uma migração aditiva (relaxar o CHECK + tabelas de compartilhamento), nunca uma
refatoração do que já existe.

**Reaproveitamento deliberado, zero infraestrutura nova:** o upload de arquivo reusa o bucket
privado `profissional` (Fase 2, migration 0004) na pasta `"<user_id>/biblioteca/..."` — as
policies de storage já são por pasta (`(storage.foldername(name))[1] = auth.uid()`), então
nenhuma migration de storage foi necessária; mesmo padrão que exames (Fase 7) já usa pra anexar
PDF/imagem no mesmo bucket, pasta "exames". O envio pela Central de Envio generaliza
`document_share_tokens` (migration 0024) com o tipo `'material'` — só um ajuste de CHECK, igual
já feito pra `'recibo'` (migration 0028). `generateMaterialPdf` cobre os 3 casos possíveis:
material escrito vira PDF renderizado (mesmo `@react-pdf/renderer` da Fase 4, sem lib nova);
arquivo já em PDF é baixado do bucket original e reenviado byte a byte (nunca reaberto/
re-renderizado); arquivo de imagem é embutido numa página de PDF — garante que
`/compartilhado/[token]` (que sempre serve `Content-Type: application/pdf`) nunca quebre por
receber uma imagem crua.

**Central de Envio:** "Material da biblioteca" virou mais um item de checkbox no painel
existente (`patient-send-panel.tsx`), com busca por título **e por tag** (pós-uso: buscar só
por título não bastava quando o material não tinha um nome fácil de lembrar, mas estava bem
taggeado) e reaproveitando `buildMensagemCombinada`. Um atalho dedicado no perfil do paciente
foi cogitado e removido no mesmo dia — era o mesmo diálogo da Central de Envio com um gatilho a
mais, sem ganho real sobre clicar em "Enviar" e marcar o item.

**Correções pós-uso (mesmo dia):** "Título" do material virou "Nome" na tela (para não colidir
com o conceito de título de seção, abaixo); o campo único "Conteúdo" do material escrito virou
uma estrutura guiada — **Título** e **Subtítulo** da seção (opcionais, campos próprios,
`secao_titulo`/`secao_subtitulo`, migration `0032`) mais o **Texto livre** (obrigatório, só
`**negrito**` como formatação — sem `#`/`-` de linha, mais fácil de aprender pra quem não é
técnico); Tags passou a ser **obrigatória** nas duas formas de criação (escrito e arquivo). No
PDF gerado, o Nome do material nunca aparece (é só organização interna da biblioteca) — quem
ocupa visualmente o lugar do título é o campo Título da seção, com Subtítulo abaixo em negrito
(tamanho intermediário) e o texto corrido em peso normal. Nova opção "Visualizar" na listagem
(ícone de olho, só para material escrito) abre esse PDF numa aba nova via rota própria
(`/biblioteca/[id]/pdf`, mesmo padrão de `/planos/[id]/pdf`), pra conferir como o material vai
chegar ao paciente antes de enviar.

`npm run build`, `npm run lint` e `npm test` (236/236 ao final desta rodada — 9 testes novos em
`material-markdown.test.ts`/`material-pdf-document.test.ts`, cobrindo o negrito inline e o
smoke test de renderização com título/subtítulo/imagem) passam.

**Comunidade — permanece ADIADA.** Não implementado, nenhuma migration escrita. Retomar exige,
no mínimo: anonimização automática de caso clínico compartilhado (validada antes de qualquer
publicação) e moderação/denúncia — sem isso, compartilhar é incidente de LGPD e passivo legal em
potencial. `visibilidade` já preparada (ver acima) pra essa retomada ser aditiva.

**Canal de feedback (2026-09-21) — construído no lugar da comunidade, como preparação prática
para os primeiros usuários reais.** Em vez de abrir a superfície de compartilhamento entre
profissionais (que segue sem base de usuários pra justificar o risco), o pedido foi um canal
direto e simples de feedback — a peça que efetivamente prepara o produto pra receber
nutricionistas de verdade, sem o risco de LGPD da comunidade.

Migration `0033`: tabela `feedback` (`tipo` orientação/problema/elogio/outro, `mensagem`,
contexto capturado automaticamente — `rota`, `user_agent`, `viewport` — e `lido`, sempre
`false` na criação). RLS deliberadamente mínima: `INSERT` só com o próprio `user_id`, `SELECT`
só do próprio registro, **nenhuma policy de admin** — leitura é manual pelo painel do Supabase
(service role, ignora RLS) por decisão explícita do usuário, pra não introduzir o primeiro
usuário privilegiado do sistema por conveniência (mesma cautela já registrada sobre
multi-tenancy/papéis desde a Fase 1). Sem notificação por e-mail, sem soft delete, sem UI de
listagem do próprio histórico — o escopo pedido é só "enviar e sumir da tela".

Gatilho: inicialmente um item dentro do menu de conta na topbar; pós-uso no mesmo dia, o usuário
pediu mais visibilidade — virou um ícone próprio (círculo de interrogação) na topbar, à esquerda
do bloco de usuário/avatar, que abre um menuzinho com duas opções: **Feedback** (o formulário) e
**Suporte** (fase futura, item visível mas desabilitado com selo "Em breve", mesmo padrão já
usado nos itens "em desenvolvimento" da barra lateral). Ainda não é um botão flutuante fixo por
cima do conteúdo — continua vivendo na topbar, só que com ícone próprio em vez de escondido
atrás de "Editar perfil".

Contexto automático: `usePathname()` (rota), `navigator.userAgent` e
`` `${window.innerWidth}x${window.innerHeight}` `` (viewport) — capturados no momento do envio,
sem o profissional digitar nada disso. Único campo obrigatório é a mensagem (mínimo de
caracteres só pra barrar envio vazio) — zero atrito deliberado, pedido explícito. Aviso de
privacidade fixo no formulário ("evite incluir nome, prontuário ou qualquer dado de paciente na
mensagem") — o profissional escrever "quando abri o prontuário da Maria..." sem pensar colocaria
dado de saúde de terceiro num canal sem o aparato de RLS/consentimento do resto do projeto.
Confirmação após enviar é uma tela própria dentro do diálogo ("Agradecemos pelo Feedback!"), não
um toast genérico — pedido explícito do usuário.

`npm run build`, `npm run lint` e `npm test` passam. Sem teste unitário novo: a lógica é um
insert simples sem cálculo ou regra de negócio própria (mesmo critério de `library_materials`).

### Critérios de aceite (biblioteca pessoal)
- [x] Material criado escrevendo ou enviando arquivo, nunca as duas formas ao mesmo tempo
      (garantido por CHECK no banco, não só validação de formulário).
- [x] Listagem com busca por título, filtro por tipo e por tag, paginação — mesmo padrão de
      `/receitas`.
- [x] Material reutilizável: mesmo material enviado a mais de um paciente sem recriar nada.
- [x] Busca da Central de Envio funciona por título e por tag.
- [x] Nome do material (organização interna) nunca aparece no PDF enviado ao paciente.
- [x] Não duplica receitas/alimentos — biblioteca é só orientação/educação (nenhuma coluna de
      macro/nutrição na tabela).
- [x] Isolado por profissional via RLS (`user_id = auth.uid()`, mesmo padrão de `recipes`) —
      sem script de isolamento ao vivo dedicado desta vez (mesmo critério já usado em
      `recipe_ingredients`/`meal_templates`: risco equivalente ao de outras tabelas já cobertas
      pelo padrão RLS geral, não um caso novo de alto risco como fotos/exames).

### Riscos (mitigado)
Reabrir compartilhamento/comunidade sem base de usuários ativa seria esforço sem retorno e
risco de LGPD prematuro — por isso o escopo desta rodada ficou só na biblioteca pessoal,
mantendo `visibilidade` pronta para a extensão futura ser aditiva.

---

## PHASE 11 — Polimento, acessibilidade e QA · `IN_PROGRESS` · `HIGH`

**Contínua, com auditoria formal antes de cada release.**

### Bloco A — segurança · `DONE` (2026-09-21)

**Objetivo:** não adicionar funcionalidade — tentar quebrar o que já existe.

```
[x] Teste de isolamento entre profissionais (TODAS as tabelas com RLS + Storage)
[x] Rate limiting nas operações caras (gerar PDF/link, enviar arquivo)
[x] Política de senha forte (mínimo 8 + bloqueio de senha comum)
```

**1. Teste de isolamento — `scripts/test-security-isolation-full.mjs`.** Suíte única cobrindo
as **28 tabelas com RLS do projeto** (patients, anamnesis, anthropometric_assessments, foods,
recipes, recipe_ingredients, meal_plans, meals, meal_items, appointments, tasks,
patient_consents, lab_exams, lab_markers, patient_photos, expenses, expense_occurrences,
patient_billings, payments, library_materials, feedback, document_share_tokens,
plan_share_tokens, profiles, audit_log) e os **5 buckets de Storage**
(profissional/receitas/planos/documentos/fotos-evolucao). Cria 2 contas descartáveis (A e B) e,
para cada tabela/bucket, tenta como B — com o JWT real de B, nunca a service role — ler, alterar
e excluir o que é de A. Mesma regra de execução já usada desde a Fase 2 (`test-storage-isolation.mjs`):
qualquer sucesso numa tentativa que deveria falhar para o script imediatamente com o detalhe
exato do vazamento. Ordem de teste pensada pra segurança da própria suíte: tabelas-filha antes
das mães, e `patients` (pai transitivo de quase tudo) por último — assim um vazamento real numa
tabela cedo no teste não apagaria em cascata a evidência das tabelas ainda não testadas.

Ficaram fora desta rodada (mesmo padrão RLS `auth.uid() = user_id` já comprovado correto em mais
de vinte outras tabelas — risco residual baixo, não um caso novo): `meal_templates`,
`meal_template_items`, `meal_item_substitutions`, customização pessoal de
`lab_reference_ranges`.

**Executado em 2026-09-21 contra o projeto Supabase real — 87/87 verificações passaram, nenhum
vazamento encontrado.** Contas de teste descartáveis, criadas e removidas automaticamente ao
final (`npm run test:security-isolation-full`, exige `SUPABASE_SERVICE_ROLE_KEY` temporário no
`.env.local`, removido logo depois de rodar).

**2. Rate limiting — decisão registrada com o usuário antes de implementar.** Netlify Functions
são serverless (sem estado em memória entre invocações) — um contador em variável de módulo não
funcionaria. Duas opções foram avaliadas: (a) contador no Postgres via função `security definer`,
zero infraestrutura/dependência nova; (b) Upstash Redis + `@upstash/ratelimit`, mais "de
livro-texto" mas exige serviço externo novo. **Escolhida a opção (a)** — mesmo princípio de
sempre no projeto (RLS, audit_log, soft delete: tudo mora no Postgres, nada bolt-on). Escopo
final das operações protegidas, também acordado com o usuário: **gerar PDF/link de
compartilhamento** e **enviar arquivo** — as duas categorias de operação cara que de fato
existem hoje no produto ("convite" e "importação" citados no pedido original não correspondem a
nenhuma tela real: convite não existe no sistema, e a única importação é um script de admin que
o nutricionista nunca aciona).

Migration `0034`: tabela `rate_limit_counters` (user_id, ação, início da janela, contagem) sem
NENHUMA policy de select/insert/update/delete para `authenticated` — só a função
`check_rate_limit` (security definer) toca nela, sempre usando `auth.uid()` internamente (nunca
recebe um user_id do chamador, pra um usuário nunca poder incrementar/checar em nome de outro).
Janela **fixa** (não deslizante) — mais simples que sliding window, suficiente pra conter abuso.
`INSERT ... ON CONFLICT DO UPDATE SET contagem = contagem + 1` é atômico no Postgres, o que
resolve exatamente o problema de "sem estado compartilhado entre invocações" apontado no pedido.

`src/lib/rate-limit.ts` centraliza os limites (`RATE_LIMITS`, hoje 30 tentativas/hora pra cada
categoria) e falha **aberta** de propósito: se a própria checagem der erro, a operação segue
normalmente — o rate limiter nunca deve virar um jeito de derrubar o produto sozinho. Aplicado
no início de cada Server Action que gera PDF/link (as 5 funções de `document-share.ts` +
`createPlanShareLink`) ou recebe arquivo (`uploadProfileFile`, `uploadRecipeImage`,
`uploadLabExamFile`, `uploadPatientPhoto`, `createLibraryMaterialComArquivo`), e nos dois Route
Handlers de PDF (`/planos/[id]/pdf`, `/biblioteca/[id]/pdf`, que retornam HTTP 429 quando
estourado). Verificado com `scripts/test-rate-limit.mjs` (`npm run test:rate-limit`): libera até
o limite, bloqueia na tentativa seguinte, contador é isolado por usuário E por ação — 6/6
passaram contra o projeto real.

**3. Política de senha.** Mínimo subiu de 6 para **8 caracteres** em `registerSchema`/
`resetPasswordSchema` (`src/lib/validations/auth.ts`), mais bloqueio de ~45 senhas triviais
conhecidas (`src/lib/validations/common-passwords.ts`, ex.: "123456", "senha123", "qwerty123").
7 testes novos em `auth.test.ts`. **Isso é só a camada de UX no formulário** — cadastro e reset
de senha chamam `supabase.auth.signUp()`/`updateUser()` direto do navegador, sem passar pelo
nosso servidor, então a autoridade de verdade é a configuração de Auth no painel do Supabase
(comprimento mínimo + "Leaked password protection", que checa contra vazamentos reais via
HaveIBeenPwned) — ajustada manualmente pelo usuário, não dá pra configurar por código.

`npm test` (243/243), `npm run lint` e `npm run build` passam.

### Riscos (mitigado)
Rate limiting mal implementado pode virar um jeito de derrubar o próprio produto (se travar
usuário legítimo, ou se a checagem em si cair o sistema todo). Mitigado com falha aberta
deliberada e limites generosos (30/hora) — pensado pra conter abuso, não pra ser um obstáculo no
uso normal.

### Bloco B — acessibilidade e responsividade · `DONE` (2026-09-22)

```
[x] Navegação completa por teclado nos componentes customizados (comboboxes)
[x] Alternativa textual para os gráficos SVG (evolução de peso/IMC e de marcador laboratorial)
[x] Formulários: label associado a todo campo, erros anunciados por leitor de tela
[x] Auditoria de contraste (WCAG AA) — 2 ajustes aplicados
[x] Tabela de plano alimentar no celular — layout em cartões
[x] Revisão de responsividade (375px) — 6 piores problemas corrigidos
[x] Marcação semântica `aria-required` nos campos obrigatórios (além do "*" visual)
[ ] Testes E2E dos fluxos críticos (Playwright)
[ ] Observabilidade (Sentry)
```

**1. Navegação por teclado.** Os campos de busca customizados do projeto (`FoodCombobox`,
`RecipeCombobox`, `PatientCombobox`, e o combobox de marcador em `LabMarkerForm`) não usam
nenhum primitivo do Radix por baixo — são um `<Input>` + lista de resultados feitos à mão, então
não ganhavam de graça o que os Dialogs/Dropdowns do Radix já resolvem. Criado
`src/lib/use-combobox-keyboard.ts`, um hook único reaproveitado nos quatro: seta cima/baixo
percorre os resultados, Enter seleciona o destacado, Escape fecha sem selecionar. Padrão ARIA de
combobox completo (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`,
`role="listbox"`/`"option"`) — o foco real nunca sai do campo de texto (`tabIndex={-1}` nos
botões de resultado), evitando um segundo caminho de navegação confuso. O reordenamento de
ingredientes da receita (setas cima/baixo, botões reais) e o arrastar-para-remarcar da Agenda (já
tinha alternativa via botão "Remarcar", decisão da Fase 5) já eram acessíveis — nenhuma mudança
necessária ali. Foco visível em toda a interface já vinha correto desde o início (todo primitivo
do kit de UI usa `focus-visible:ring`, nunca `outline-none` sem substituto).

**2. Gráficos SVG.** `EvolutionChart` (peso/IMC) e `MarkerChart` (evolução de marcador
laboratorial, dentro de `LabMarkerEvolutionSection`) não tinham `role`, `aria-label` nem
alternativa textual — um leitor de tela não enxergava nada ali. Adicionado `role="img"` +
`<title>` com a descrição da tendência (ex.: "de 78kg em 10/01 até 74kg em 15/03, ao longo de 5
avaliações"), mais um botão "Ver dados em tabela" que troca o gráfico por uma tabela acessível
com os mesmos pontos — não escondida, uma alternativa de verdade, útil também pra quem prefere
números a gráfico. A barra de proporção por categoria em `CustoConsultorioCard` (financeiro) já
tinha o valor em texto ao lado — só ganhou `aria-hidden` na barra decorativa, sem precisar de
tabela (não é um gráfico independente, é reforço visual de um número que já está escrito).

**3. Formulários.** Dois problemas sistêmicos corrigidos em todo o projeto: (a) 74 mensagens de
erro (`<p className="text-destructive">`) em 32 arquivos não eram anunciadas por leitor de tela —
todas ganharam `role="alert"`; (b) ~30 campos usavam `<Select>`/`<Tabs>`/botão de arquivo com um
`<Label>` visualmente ao lado mas sem associação programática (não dá pra usar `htmlFor` num
`SelectTrigger`, que é um botão, não um input nativo) — cada um ganhou `useId()` +
`aria-labelledby` no controle real (ou, pra `<Tabs>` de seção como "Recorrência"/"Como será
pago?", no `TabsList`). Um caso (`"Consultas do pacote *"` em `package-form-dialog.tsx`) não é
label de um único controle — virou um cabeçalho de seção comum, já que cada input da lista abaixo
tem seu próprio `Label`/`htmlFor`.

Numa rodada seguinte, adicionado também `aria-required="true"` no controle real de todo campo
unicamente obrigatório — mapeado schema por schema em `src/lib/validations/*.ts`, cobrindo
`Input`/`Textarea`/`SelectTrigger`/`TabsList` conforme o tipo de controle. Ficaram de fora, de
propósito: campos condicionalmente obrigatórios só via `.refine()` cruzando campos (ex.: CRN+UF
do perfil, dia/mês/data de vencimento da despesa conforme a recorrência) e campos de
`z.discriminatedUnion` cujo conjunto obrigatório muda por branch (status financeiro de consulta e
de pacote) — mesma exclusão já aplicada ao cabeçalho "Consultas do pacote *" acima. Também ficaram
de fora as linhas de "adicionar item" de ingrediente de receita e item de refeição
(`FoodCombobox`/quantidade), que hoje não têm nenhum `<Label>` associado — gap de acessibilidade
distinto, não coberto por este item.

**4. Contraste (WCAG AA).** Auditoria encontrou 2 problemas reais (o laranja de destaque, suspeito
inicial do usuário, na verdade nunca é usado como texto sozinho — só em botão/selo com contraste
alto, não precisou mudar): `--muted-foreground` (usado em ~96 arquivos) tinha só 4.06-4.41:1,
abaixo do mínimo de 4.5:1 — escurecido de 45% pra 38% de luminosidade (mesma matiz/saturação,
mudança imperceptível a olho nu); `--destructive` sobre o próprio fundo do badge (10% de opacidade)
tinha 4.13:1 — escurecido de 51% pra 47%. Ambos em `src/app/globals.css`, sem tocar em nenhuma
outra cor da identidade visual — decisão e valores apresentados ao usuário antes de aplicar.

**5. Tabela de plano alimentar no celular.** A tabela escondia Proteína/Carboidrato/Gordura
abaixo de `sm:` — exatamente o dado que o profissional mais precisa ver rápido. Extraído
`useMealItemEditor` (`src/components/meal-plans/use-meal-item-editor.ts`) com todo o estado/ações
de um item (antes só dentro de `MealItemRow`), reaproveitado por `MealItemRow` (tabela, `sm:`+) e
pelo novo `MealItemCard` (cartão empilhado, < `sm:`) — a mesma lógica de negócio por trás das duas
apresentações, nunca duplicada. No celular, todos os macros aparecem sempre, sem esconder nada;
no computador, a tabela continua exatamente como já era. Proposta de layout apresentada e
aprovada pelo usuário antes de implementar.

**6. Responsividade geral (375px).** Auditoria estática (sem navegador) por todas as rotas e
componentes de layout complexo. Base do projeto já é sólida (a maioria das telas já usa
`flex-col sm:flex-row`/`grid-cols-1 sm:grid-cols-N` corretamente); os 6 piores problemas
corrigidos: (1) aba Financeiro do paciente — coluna de ações com `w-[240px]` fixo espremia
Descrição/Valor/Vencimento — largura fixa removida, "Vencimento" escondido em `sm:`; (2) tabs de
recorrência da despesa (`grid-cols-5`) — "Trimestral"/"Semestral" não cabiam — vira
`grid-cols-3 sm:grid-cols-5` (2 linhas no celular); (3) abas do perfil do paciente
(`flex-wrap` numa `TabsList` de altura fixa) — linhas extras vazavam do fundo arredondado —
`h-auto` adicionado; (4) tabela de consentimentos — 6 colunas sem nenhuma escondida — Forma/
Revogado em/Observações agora escondem em `sm:`/`md:`; (5) tabela de despesas — Categoria/
Recorrência agora escondem em `sm:`/`md:`; (6) "Novo pacote" na Agenda — grade de Data/Início/
Término 3 colunas fixas — vira `grid-cols-1 sm:grid-cols-3`.

**Rodada de acompanhamento (2026-09-22)** revisitou os achados menores não corrigidos na
primeira rodada e fechou os dois que se confirmaram reais: (a) a tabela "Pagos" da aba
Financeiro do paciente (`patient-finance-panel.tsx`) tinha 4 colunas sempre visíveis
(Descrição/Valor/Recebido em/Forma) sem nenhuma escondida, mesma classe de problema do item (1)
— "Recebido em" agora esconde em `md:`, "Forma" em `sm:`; (b) o `DialogContent`/
`AlertDialogContent` compartilhados (`src/components/ui/dialog.tsx`,
`src/components/ui/alert-dialog.tsx`) usavam `w-full` sem margem — em 375px o modal encostava
nas duas bordas da tela com 0px de respiro; trocado para `w-[calc(100%-2rem)]`, dando 1rem de
margem lateral consistente em todos os diálogos do app (correção de alto alcance por afetar o
componente base usado por dezenas de telas). Outros candidatos revisados e descartados por não
serem bugs reais: `Table` já embrulha em `overflow-auto` (degrada com scroll horizontal, não
quebra layout), a grade de 7 colunas do calendário mensal (`month-view.tsx`) usa frações
flexíveis sem largura mínima fixa, e a `WeekView` da Agenda já tem `overflow-x-auto` proposital
(visão semanal larga é um scroll horizontal aceitável, não uma redesign pendente).

`npm test` (243/243), `npm run lint` e `npm run build` passam.

### Riscos (mitigado)
Mudar cor de texto usada em ~96 arquivos de uma vez poderia introduzir inconsistência visual
sutil. Mitigado testando a métrica de contraste antes (não só "parece melhor") e mudando só
luminosidade, preservando matiz/saturação — a mudança é imperceptível a olho nu, mensurável só em
contraste.

### Pendências conhecidas (não bloqueiam o fechamento do bloco)
- Testes E2E (Playwright) e observabilidade (Sentry) — itens finais da Fase 11, ainda não
  iniciados.
- Linhas de "adicionar item" sem `<Label>` (ingrediente de receita, item de refeição) — não
  ganharam `aria-required` junto com o resto do formulário porque não têm associação de label
  nenhuma hoje; ficou de fora do escopo do item de `aria-required` acima.

---

## Ordem recomendada

```
1 → 2 → 3 → 4 → [MVP · validar com usuários reais]
     → 5 → 6 → 7 → [V1 · concluído em 19/09/2026]
     → 9 → [V2 · Fase 9 concluída em 20/09/2026]
     → 10 (biblioteca pessoal concluída em 21/09/2026; comunidade segue adiada)
8 adiada (ver DECISIONS.md D2) — não bloqueia 9/10, retomar só se/quando fizer sentido reabrir.
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
