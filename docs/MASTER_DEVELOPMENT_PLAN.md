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

## PHASE 1 — Fundação e rede de segurança · `TODO` · `CRITICAL`

**Objetivo:** tornar seguro alterar o sistema. Nada de funcionalidade nova.

**Dependências:** nenhuma.

**Por que primeiro:** o cálculo nutricional gera dado clínico. Hoje não há teste que impeça uma regressão silenciosa. E qualquer erro em produção vira tela branca.

### Tarefas

```
[ ] Configurar Vitest + @testing-library/react
[ ] Testes unitários de lib/nutrition.ts (proporção, soma, snapshot, valores nulos)
[ ] Testes dos schemas Zod (campos numéricos opcionais vazios)
[ ] Criar src/app/(app)/error.tsx e loading.tsx
[ ] Criar src/app/(auth)/error.tsx
[ ] Criar src/app/global-error.tsx e not-found.tsx
[ ] Gerar tipos reais: supabase gen types typescript > src/lib/types/database.generated.ts
[ ] Reintroduzir o generic <Database> nos clients com os tipos gerados
[ ] Remover a interface Database escrita à mão
[ ] Paginação em /pacientes, /alimentos e /planos (range + controles)
[ ] Migration 0003: índice gin_trgm_ops para busca ilike
[ ] Debounce na busca de pacientes (250ms, igual ao combobox)
[ ] Migrar deploy Netlify para repositório Git
[ ] Apagar .env.production; usar variáveis do painel
[ ] Configurar SMTP próprio (Resend ou Brevo) no Supabase
[ ] DECIDIR e documentar: multi-tenancy (individual vs clínica)
[ ] DECIDIR e documentar: paciente como usuário autenticado ou não
[ ] Registrar as duas decisões em docs/DECISIONS.md
```

### Critérios de aceite
- `npm test` roda e passa; cobertura de `nutrition.ts` ≥ 90%.
- Erro em qualquer rota mostra tela de recuperação, não tela branca.
- Alterar uma coluna no banco e rodar `gen types` quebra o build se o código estiver desatualizado.
- Listagem com 500 registros carrega em página de 20.
- E-mail de recuperação chega em Gmail e Outlook.
- `DECISIONS.md` responde às duas perguntas com justificativa.

### Arquivos prováveis
`vitest.config.ts`, `src/lib/nutrition.test.ts`, `src/lib/validations/*.test.ts`, `src/app/(app)/{error,loading}.tsx`, `src/app/{global-error,not-found}.tsx`, `src/lib/types/database.generated.ts`, `src/lib/supabase/{client,server,middleware}.ts`, `supabase/migrations/0003_search_indexes.sql`, `docs/DECISIONS.md`

### Riscos
Reintroduzir o generic `<Database>` pode ressuscitar os erros de `never` — por isso usar tipos **gerados**, não manuais. Se o problema voltar, manter untyped e documentar.

### QA
Rodar suíte; forçar erro em Server Component e verificar `error.tsx`; testar paginação com dados de volume; enviar recuperação de senha para 3 provedores.

---

## PHASE 2 — Identidade profissional · `TODO` · `HIGH`

**Objetivo:** o nutricionista existe como profissional, não só como login. Pré-requisito de todo documento gerado.

**Dependências:** Fase 1.

### Tarefas

```
[ ] Migration 0004: profiles += telefone, crn_uf, especialidade,
    logo_url, assinatura_url, cor_marca, endereco, bio
[ ] Configurar Supabase Storage: bucket privado 'profissional'
[ ] Políticas de Storage (cada um acessa só a própria pasta)
[ ] Componente de upload com preview, limite de tamanho e tipo
[ ] Página /perfil com formulário
[ ] Ativar item "Editar perfil" na topbar
[ ] Exibir CRN e nome no layout
[ ] Validação de formato de CRN
[ ] Teste: upload não acessível por outro usuário
```

### Critérios de aceite
- Perfil completo persiste e reflete na topbar.
- Logo e assinatura fazem upload e aparecem no preview.
- URL de arquivo de outro profissional retorna 403.
- CRN validado.

### Riscos
Storage mal configurado vaza arquivo entre contas. **Testar explicitamente o acesso cruzado antes de fechar a fase.**

---

## PHASE 3 — Consultório clínico completo · `TODO` · `HIGH`

**Objetivo:** fechar as lacunas do atendimento e preservar histórico clínico.

**Dependências:** Fases 1 e 2.

### Tarefas

```
[ ] Migration 0005: anamnesis versionada (1:N com data_registro)
[ ] Migration 0005: deleted_at em patients, anamnesis, assessments, meal_plans
[ ] Migration 0005: tabela audit_log (tabela, registro_id, acao, user_id, timestamp, diff)
[ ] Trigger de auditoria nas tabelas clínicas
[ ] Soft delete em todas as actions de exclusão
[ ] Filtrar deleted_at nas policies RLS
[ ] Editar avaliação antropométrica (updateAssessment)
[ ] Histórico de anamneses no perfil (linha do tempo)
[ ] Exportar dados do paciente (LGPD - portabilidade)
[ ] Confirmação ao sair de formulário com alterações não salvas
[ ] Teste: exclusão não remove fisicamente
[ ] Teste: audit_log registra alteração clínica
```

### Critérios de aceite
- Excluir paciente o remove da lista mas preserva os dados.
- Nova anamnese não sobrescreve a anterior; ambas visíveis com data.
- Toda alteração em dado clínico gera linha em `audit_log`.
- Exportação gera JSON/PDF completo do paciente.

### Riscos
Soft delete exige revisar **todas** as queries existentes. Esquecer um filtro faz registro excluído reaparecer.

---

## PHASE 4 — Plano alimentar profissional + PDF · `TODO` · `CRITICAL`

**Objetivo:** fechar o MVP. O nutricionista entrega ao paciente um plano com a sua marca.

**Dependências:** Fases 2 e 3.

**Por que é o coração do MVP:** é o artefato que justifica a assinatura. E é hoje o fluxo mais custoso do produto (~40 interações para um plano de 5 refeições).

### Tarefas

```
[ ] Importar TACO completa (597 alimentos) via pipeline brolesi/taco
[ ] Duplicar plano alimentar existente
[ ] Templates de refeição reutilizáveis
[ ] Substituições de alimento na refeição (equivalentes)
[ ] Observações por refeição
[ ] Meta calórica/macros do plano + comparativo com o calculado
[ ] Cálculo de gasto energético (Harris-Benedict / Mifflin-St Jeor)
[ ] Geração de PDF do plano com identidade do profissional
[ ] Rodapé de fonte no PDF (buildFonteFooter já existe)
[ ] Compartilhar PDF via WhatsApp (link wa.me)
[ ] Teste: macros do PDF conferem com a tela
```

### Critérios de aceite
- Montar plano de 5 refeições em menos de 5 minutos.
- PDF sai com logo, nome, CRN e atribuição correta de fonte.
- Duplicar plano cria cópia independente (snapshots preservados).
- Totais do PDF idênticos aos da tela.

### Riscos
Geração de PDF em serverless tem limite de memória/tempo. Avaliar `@react-pdf/renderer` (JS puro) antes de Puppeteer, que é pesado demais para Netlify Functions.

### 🏁 Fim do MVP — parar e validar com nutricionistas reais antes de seguir.

---

## PHASE 5 — Agenda e rotina · `TODO` · `HIGH`

**Dependências:** Fases 3 e 4, e a decisão de multi-tenancy.

```
[ ] Migration 0006: appointments (paciente, data, duracao, status, tipo, observacoes)
[ ] Migration 0006: tasks (pendências vinculadas a paciente/consulta)
[ ] Calendário mensal e semanal
[ ] CRUD de agendamento
[ ] Status: agendado, confirmado, realizado, faltou, cancelado
[ ] Consulta mostra pendências do paciente (exames, questionário, plano)
[ ] Próximos atendimentos no dashboard
[ ] Lembrete via WhatsApp (link)
```

**Aceite:** agendar em ≤3 cliques; consulta mostra o contexto do paciente; dashboard lista os próximos 7 dias.
**Risco:** fuso horário. Armazenar em `timestamptz`, exibir no fuso do profissional.

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

| # | Decisão | Bloqueia | Prazo |
|---|---|---|---|
| D1 | Conta individual ou clínica com equipe? | Fase 5+ | Fase 1 |
| D2 | Paciente é usuário autenticado? | Fase 8 | Fase 1 |
| D3 | Licenciamento de TBCA e Tucunduva | Fase 4 | Antes de importar |
| D4 | Biblioteca de PDF | Fase 4 | Fase 4 |

**Sobre D3:** a TACO autoriza reprodução com citação de fonte. **TBCA e Tucunduva não foram verificados.** A Tucunduva é obra comercial protegida — redistribuir seus dados num SaaS pago é provavelmente inviável sem licença. Isso exige parecer jurídico, não decisão de engenharia.
