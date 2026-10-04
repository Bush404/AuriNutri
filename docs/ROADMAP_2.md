# ROADMAP 2 — AuriNutri

**Versão:** 1.0 · **Data:** 25/09/2026
**Base:** lista de lacunas escrita pela responsável pelo produto (nutricionista) depois de uma semana
usando o AuriNutri no próprio consultório (22–25/09/2026) + leitura do código atual.
**Continua:** `docs/MASTER_DEVELOPMENT_PLAN.md` (Roadmap 1, Fases 0–11). A numeração das fases
continua de onde o Roadmap 1 parou (Fase 12 em diante).

---

## Objetivo do Roadmap 2

Deixar o AuriNutri pronto para ser **o único software do consultório da própria responsável pelo
produto**, no nível dos softwares de mercado nas três telas centrais do atendimento:
antropometria, cálculo energético e plano alimentar.

Sequência de lançamento combinada em 22/09/2026 (não muda):

```
Roadmap 2 (uso próprio) → testadoras convidadas → jurídico + assinatura → lançamento
```

Mesmas regras do Roadmap 1: uma fase por vez, checkpoint ao final de cada uma, e a mesma definição
de `DONE` (funciona, valida entrada, tem loading, empty state, trata erro, respeita RLS, não vaza
dados entre profissionais, tem teste proporcional ao risco).

---

## O que já existe e muda o tamanho de alguns pedidos

A leitura do código mostrou que parte do que foi pedido já está meio pronta:

| Pedido | O que já existe | O que falta |
|---|---|---|
| Tarefas na agenda | Tabela `tasks` e Server Actions (`src/lib/actions/tasks.ts`) desde a Fase 5 | **Nenhuma tela usa.** Falta só a interface |
| Editar / excluir / ativar plano | `updateMealPlan`, `deleteMealPlan`, `toggleMealPlanStatus` já existem | Botões na lista de planos (`meal-plan-list.tsx`) |
| Substitutos | Tabela `meal_item_substitutions` + sugestão de quantidade por kcal (Fase 4) | Tela de **comparação** lado a lado |
| Cálculo energético | Mifflin-St Jeor e Harris-Benedict em `src/lib/energy.ts` | Aba própria no paciente, demais fórmulas, histórico por data |
| Metas do plano | `meta_kcal`, `meta_proteinas_g`, etc. em `meal_plans` (migration 0007) | Distribuição por % do GET ou g/kg e painel fixo |
| Logo e assinatura | `logo_url`, `assinatura_url`, `cor_marca` em `profiles` (Fase 2) | A definir (ver decisão R6) |

---

## PHASE 12 — Segurança e velocidade · `TODO` · `CRITICAL`

**Por que primeiro:** afeta todas as telas que já existem e todas que vão ser criadas. Corrigir
lentidão agora custa menos do que depois de dobrar o número de telas.

### Bloco A — segurança
```
[x] Atualizar Next.js 14.2.13 → 14.2.35 (publicado, commit 6bad00f)
[x] Troca de versão maior: Next.js 16.3.6 + React 19 (antecipada para esta fase, ver nota abaixo)
[x] npm audit de novo: nenhuma falha no Next.js; restam 3 moderadas só em ferramentas de
    desenvolvimento (vitest, csv-parse), que não vão para o site
[x] Backup: verificado — o plano gratuito do Supabase não deixa baixar nem restaurar backup
[x] `npm run backup:db` refeito: todas as 29 tabelas (antes 8), contas de login e os arquivos dos
    5 buckets; busca em páginas (antes parava em 1.000 linhas por tabela sem avisar) e tenta de
    novo quando o Storage responde Gateway Timeout. Testado: 949 linhas, 4 contas, 45 arquivos
[x] Verificação em duas etapas ativada pela responsável em Gmail, GitHub, Supabase, Netlify, Resend, Sentry e registro do domínio (25/09/2026)
```

**Troca para Next 16 (25/09/2026), decidida com a responsável pelo produto:** a linha 14 do Next.js
não recebe mais correções, então as falhas publicadas depois do fim do suporte só foram corrigidas
nas versões 15/16. A troca foi antecipada para antes das Fases 15–17 porque fica mais cara a cada
tela nova. O que mudou:
- `cookies()`, `params` e `searchParams` ficaram assíncronos: `createClient()` do servidor virou
  `async` (133 chamadas com `await`).
- `next lint` saiu do Next 16: ESLint 9 com `eslint.config.mjs`. As regras novas do
  `eslint-plugin-react-hooks` pensadas para o React Compiler (`purity`, `refs`,
  `set-state-in-effect`, `use-memo`) ficam como **aviso**, porque não apontam bugs. Limpeza pendente
  abaixo.
- `middleware.ts` **não** foi renomeado para `proxy.ts`: o `proxy` só roda no runtime Node, e o
  `middleware` mantém o Edge runtime que o Netlify usa hoje.

```
[ ] Limpar os 21 avisos do lint (regras do React Compiler + eslint-disable sem uso)
```
**Achado (25/09/2026):** o `npm audit` aponta a versão do Next.js como crítica. Entre as falhas
conhecidas está a de **pular o middleware** (GHSA-f82v-jwr5-mffw), corrigida na 14.2.25. O impacto
real no AuriNutri é baixo porque há duas outras barreiras: `(app)/layout.tsx` também redireciona
quem não tem sessão, e a RLS do Postgres nega dados de outra conta (87/87 checagens na Fase 11).
Mesmo assim, é a correção mais barata do roadmap e deve ser feita primeiro.

**Condição fixa (decidida em 25/09/2026): plano pago do Supabase antes do primeiro paciente real.**
O backup manual serve só enquanto há dados de teste. Ele depende de alguém lembrar de rodar e grava
dados de saúde num computador pessoal (risco de LGPD). O plano pago tem backup diário automático
com restauração e não pausa projetos parados. Ele precisa estar ativo **antes do que acontecer
primeiro**: a responsável pelo produto começar a atender pelo AuriNutri, ou a primeira testadora
cadastrar pacientes. Conferir o preço atual no site do Supabase antes de contratar.

### Bloco B — velocidade
```
[x] Medir antes de mexer (Sentry, 7 dias de uso real): cada consulta ao banco leva ~160–260 ms
    (mediana) a partir do servidor; no navegador, /login ~2 s (pior caso ~7 s) e dashboard,
    pacientes e financeiro ~1 s
[x] Regiões conferidas: Supabase em sa-east-1 (São Paulo), Netlify Functions em us-east-2 (Ohio).
    Cada consulta atravessa o continente. **Esta é a causa principal.**
[x] Buscas independentes juntas (Promise.all): layout (todas as telas), dashboard, agenda e plano
    alimentar (de 4 buscas em fila para 2). Perfil buscado sem getUser() antes, porque a RLS de
    profiles já limita ao próprio usuário
[ ] Medir de novo em produção depois de publicar
```

**Decisão (25/09/2026): Netlify Pro + Supabase Pro juntos, quando entrarem os primeiros clientes.**
Mudar a região das Functions para São Paulo exige o plano pago do Netlify. Mover o banco para os EUA
foi descartado (dados de saúde fora do Brasil, mais cuidados de LGPD). Até lá, só as melhorias de
código acima.

**Créditos do Netlify esgotados (25/09/2026):** o plano gratuito cobra créditos por publicação, e
um dia com muitos commits enviados (inclusive só de documentação) esgotou o mês. As publicações
seguintes foram puladas ("Skipped"), entre elas a correção do Sentry no navegador (e1cf895). O site
seguiu no ar na última versão publicada. Medidas: `ignore` no `netlify.toml` pula commits só de
`docs/`/`.md`, e os commits passam a ser **acumulados localmente e enviados juntos**, uma
publicação por entrega.

```
[ ] Publicar juntos, quando os créditos renovarem: Sentry no navegador + melhorias de velocidade
[ ] Depois de publicar: confirmar o Sentry no navegador e medir de novo (registrar antes/depois aqui)
[ ] loading.tsx / esqueletos nas rotas que ainda não têm
```
Custo do middleware revisado: a validação de sessão dele leva ~30 ms (mediana), porque roda no
Edge, perto do usuário. Não é gargalo.

### Critérios de aceite
- Next.js no último patch 14.2.x, build e E2E passando.
- Tempo das páginas principais medido antes e depois, com melhora registrada em números.
- Backup do banco confirmado, com procedimento de restauração escrito.

### Riscos
Atualizar o Next.js pode mudar comportamento sutil. Por isso fica só no patch da mesma linha (14.2.x),
com `npm run build` + `npm test` + `npm run test:e2e` antes do deploy.

---

## PHASE 13 — Ajustes rápidos do dia a dia · `DONE` (25/09/2026, publicada 30/09/2026) · `HIGH`

Tudo aqui mexe em telas que já existem, sem modelo de dados novo (exceto se indicado).

### Dashboard
```
[x] Trocar o card "Ticket médio" por "Balanço dos últimos 30 dias" (recebido − despesas, período móvel)
[x] Dividir a seção inferior em duas colunas:
      esquerda: minicalendário dos próximos 7 dias, só visualização, com botão "Ver agenda completa"
      direita:  "Próximos compromissos (7 dias)" = consultas + tarefas
[x] No celular, as duas colunas empilham (calendário em cima)
```
Nome sugerido para a lista da direita: **"Próximos compromissos (7 dias)"**, porque junta consultas e
tarefas. "Próximas tarefas" daria a entender que as consultas sumiram.

**Regra de vocabulário (Fase 9):** "Balanço" é receita − despesa do período, e o card explica isso
em um tooltip. Os dados vêm de `payments`/`expense_occurrences`, que já existem.

### Tarefas (interface para o backend da Fase 5)
```
[x] Criar tarefa pela agenda (título, data, horário opcional, paciente opcional, observação)
[x] Tarefas aparecem no calendário com visual diferente das consultas
[x] Concluir / reabrir / excluir tarefa
[x] Tarefas entram em "Próximos compromissos" no dashboard
```
Tarefas **não** entram na trava de horário sobreposto (migration 0012 vale só para consultas).

### Anamnese: lista em vez de abrir a última
```
[x] Ao entrar na aba: botão "Adicionar nova anamnese" no topo
[x] Abaixo: anamneses anteriores fechadas (título/nome, data), com "Visualizar/editar" e "Excluir"
[x] Excluir usa soft delete via função security definer (padrão obrigatório desde a migration 0017)
```

### Planos alimentares
```
[x] Botões Editar, Excluir e Ativar/Desativar em cada plano da lista (actions já existem)
[x] Busca de alimento: trocar "Buscar alimento (TACO ou seus)..." por "Buscar alimentos"
```

### Critérios de aceite
- [x] Balanço de 30 dias confere com um cálculo feito à mão: `balancoUltimosDias` em `finance.ts`,
  4 testes (bordas da janela, pendências fora, saldo negativo sem erro de ponto flutuante, virada do ano).
- [x] Tarefa de uma conta não aparece para outra: `tasks` já estava no teste de isolamento; somado
  `soft_delete_anamnesis` por outra conta (retorna false). `test:security-isolation-full` 88/88.
- [x] Excluir anamnese não apaga do banco: `soft_delete_anamnesis` (migration 0037, padrão da 0017)
  só preenche `deleted_at`, e o gatilho de auditoria registra o UPDATE.

**Como ficou (25/09/2026):** migration `0037` (aplicada) acrescenta `tasks.horario` (opcional, de
parede no fuso do profissional), `anamnesis.titulo` (nome opcional) e `soft_delete_anamnesis`.
Tarefas: `TaskFormDialog` na agenda, chip tracejado com ícone de caixinha no mês, na semana (na
hora certa, ou no topo do dia se não tiver horário) e no detalhe do dia; a ordem do dia é tarefa
sem horário primeiro e depois tudo por horário (`agendaItemSortKey`, testado). O dashboard só lista
tarefas em aberto. "Editar" na lista de planos abre o plano; Ativar/Desativar e Excluir agem na
própria lista. E2E novo `tarefas.e2e.ts` (criar → dashboard → concluir → excluir), 13/13 passando.
Tudo **guardado localmente** até os créditos do Netlify renovarem (ver Fase 12).

**Ajustes pós-uso (25/09/2026), pedidos da responsável depois de testar localmente:**
- Ações de anamnese e de plano agrupadas num menu de três pontinhos.
- O card inteiro abre o registro (anamnese abre o formulário, plano abre o plano).
- A aba do paciente fica na URL (`?aba=planos`, `src/lib/url-state.ts`, History API sem ida ao
  servidor). "Voltar para <paciente>" no plano e o voltar do navegador caem na mesma aba. A
  anamnese aberta também fica na URL (`?anamnese=<id>|nova`), então o voltar do navegador fecha o
  registro e continua na aba.
- O calendário de 7 dias do dashboard deixou de ser clicável: só "Ver agenda completa" leva à agenda.
- E2E novo `navegacao-abas.e2e.ts`; 14/14 passando.

---

## PHASE 14 — Anamnese em texto livre e modelos · `DONE` (25/09/2026, publicada 30/09/2026) · `HIGH`

**Pedido:** deixar de ter caixas separadas por tema e virar uma página em branco estilo Word. Deve
ser possível importar um modelo próprio da nutricionista e só editar.

```
[x] Editor de texto rico: Tiptap 3 (títulos, negrito, itálico, sublinhado, listas, tabela, desfazer)
    — src/components/shared/rich-text-editor.tsx
[x] Nova coluna anamnesis.conteudo (migration 0038); campos por tema antigos viram só leitura
[x] Anamneses antigas: SEM conversão em massa. Registro com conteudo nulo é montado na hora a partir
    das colunas por tema (legacyAnamnesisToHtml, testado) e só ganha conteudo quando for salvo de novo
[x] "Meus modelos de anamnese": criar, editar e excluir (tabela anamnesis_templates + RLS)
[x] Nova anamnese: "Começar de" página em branco ou um modelo (o texto é copiado)
[x] "Salvar como modelo" a partir de uma anamnese, com aviso para tirar dados do paciente
[x] Colar do Word mantendo títulos, negrito, listas e tabelas (o resto é descartado)
[x] Exportação LGPD continua completa (select * já leva conteudo). Nenhum PDF usa anamnese hoje
[ ] Modelos prontos do AuriNutri — ADIADO por decisão da responsável (25/09/2026), entra depois
```

**Segurança do texto rico:** o HTML é limpo no servidor antes de gravar (`sanitizeRichText`,
`sanitize-html`): só passam os elementos que o editor produz; `<script>`, `<iframe>`, `<img>`,
estilos, classes, eventos (`onclick`...) e links `javascript:` são removidos. 10 testes em
`rich-text.test.ts`. Na exibição, o próprio editor só aceita os elementos do seu esquema.

**Verificado (25/09/2026):** migration 0038 aplicada; E2E novo `anamnese.e2e.ts` (texto livre →
salvar como modelo → começar de modelo → excluir modelo), 15/15 passando (a Central de Envio falhou
uma vez por tempo de geração de PDF no servidor local e passou ao repetir); isolamento 91/91 com
`anamnesis_templates`; `npm test` 274. A tabela nova também entrou no `npm run backup:db`.

### Riscos (mitigado)
- **Perda de dados:** não houve migração de dados. As colunas antigas não são tocadas nem na
  edição; o texto montado delas só vira `conteudo` quando o profissional salva.
- **HTML malicioso (colado ou importado):** limpo no servidor antes de gravar, ver acima.

---

## PHASE 15 — Antropometria profissional · `DONE` (30/09/2026, publicada 30/09 e 01/10/2026) · `CRITICAL`

**Lista de protocolos aprovada em 30/09/2026 (decisão R4):** ver `docs/FASE_15_PROTOCOLOS.md`
(montada a partir do WebDiet, com a fonte de cada item).

**Pendência:** comparar 2 ou 3 pacientes reais com o WebDiet (seção "Para revisar" de
`docs/FASE_15_PROTOCOLOS.md`).

**Por que crítica:** foi apontada como "de extrema importância" e hoje é a tela mais distante dos
softwares de mercado. Ela alimenta a Fase 16 (cálculo energético) e a Fase 17 (planejamento).

Ao clicar em "Nova avaliação", o profissional escolhe entre três tipos:

### Bloco A — Adultos e idosos · `DONE` (30/09/2026)
```
[x] Peso, altura, IMC com classificação (OMS para adultos; Lipschitz 1994 para 60+)
[x] Circunferências completas (pescoço, tórax, ombro, cintura, abdome, quadril; braço relaxado/
    contraído, antebraço, coxa proximal/medial/distal, panturrilha dos dois lados)
[x] Dobras cutâneas (as 9 + supraespinhal)
[x] Protocolos de % de gordura à escolha (Pollock 3 e 7, Petroski, Guedes, Durnin, Faulkner) com
    Brozek ou Siri, calculando massa gorda, massa magra, peso residual e massa muscular
[x] Diâmetros ósseos (úmero, fêmur, punho) → peso ósseo      [ ] compleição (não feito)
[x] Bioimpedância: digitar os valores do aparelho
[x] Idosos: altura pela altura do joelho e peso de acamado (Chumlea, só 60+), panturrilha
[x] Indicadores derivados: RCQ, RCEst, CMB (adequação + percentil), com classificação
[x] Tela em página inteira com resultados ao vivo; Editar / Duplicar / Excluir; PDF atualizado
```
Migration 0039 aplicada. Fórmulas em `src/lib/anthropometry.ts`, cada coeficiente conferido em
fonte publicada (fontes no topo do arquivo). **Revisão da nutricionista pendente** — ver a seção
"Para revisar" em `docs/FASE_15_PROTOCOLOS.md`.

### Bloco B — Crianças e adolescentes · `DONE` (30/09/2026)
```
[x] Peso/idade (até 10 anos), altura/idade, IMC/idade, peso/comprimento (<2) e peso/estatura (2–5)
    em percentil e escore-z, classificação SISVAN (nomes certos abaixo de 5 anos)
[x] Curvas de crescimento OMS (0–5 anos e 5–19 anos) por sexo, com os pontos do paciente no gráfico
[x] Idade calculada automaticamente a partir da data de nascimento e da data da avaliação
[x] % de gordura infantil (Slaughter 1988) com classificação Lohman 1987
```
Coeficientes LMS baixados de cdn.who.int (`src/lib/growth/who-lms-data.ts`, gerado); 11 pontos de
controle conferidos contra os valores de −2/+2/+3 DP publicados pela OMS.

### Bloco C — Anexar relatório externo · `DONE` (30/09/2026)
```
[x] Upload de PDF/JPEG/PNG/WEBP (bioimpedância, DEXA, laudo) com data, título e observação
[x] Opcional: peso, % gordura, massa livre de gordura e massa muscular entram na evolução
[x] Reaproveita o padrão de bucket privado + validação de arquivo das Fases 7/10; exige o
    consentimento de exames (mesma regra da Fase 7)
```

### Bloco D — Evolução · `DONE` (30/09/2026)
```
[x] Cada avaliação mostra seu próprio gráfico de evolução (todas as avaliações até aquela data)
[x] Profissional escolhe até 5 indicadores (de 15), lembrados no navegador; modo tabela
[x] PDF "Evolução física" de qualquer data, com os indicadores escolhidos, atualizado até a data
[x] Avaliações antigas (formato atual) continuam aparecendo na evolução
```
Migration 0040 aplicada. Testes: 353 de unidade, E2E 17/17, isolamento 95/95.

**Ajuste pós-uso (30/09/2026), a partir de prints do WebDiet:** a aba "Antropometria Geral" virou
só a lista por data (Evolução | Relatório | Editar | Duplicar | Excluir) com o botão largo "Nova
avaliação antropométrica". Saíram os gráficos na tela: "Relatório" baixa o PDF de uma avaliação
(índices em barras Abaixo/Normal/Acima, histórico das últimas 5, conceitos) e "Evolução" escolhe
até 5 datas e baixa o PDF comparativo (composição corporal, análises básicas e medidas, com a
variação entre datas). Sem QR code do WebDiet (não há app do paciente).

**Ajustes pós-uso (01/10/2026), pedidos da responsável depois de testar localmente** (commit 96401d5):
- A avaliação é **salva ao abrir**: "Nova avaliação" e "Duplicar" criam o registro na hora
  (`iniciarAvaliacao`) e o formulário salva sozinho a cada alteração (`useAutoSave`, com aviso
  "Salvando… / Tudo salvo"). O botão virou "Salvar e voltar"; a página `/avaliacoes/nova` saiu.
- Migration **0041** (aplicada): peso e altura deixam de ser obrigatórios, porque a avaliação existe
  antes do peso. "Último peso" (plano e contexto do paciente) e as curvas infantis ignoram
  avaliação sem peso; PDFs mostram "—".
- Nova avaliação de adulto já vem com a altura da primeira avaliação do paciente.
- Formulário: Dados básicos sempre aberta; Dobras, Circunferências, Diâmetros, Bioimpedância e
  Observações recolhíveis (fechadas ao abrir); campos de 2 em 2; coluna de resultados mais larga e
  rolando junto com a página; circunferências sem o nome repetido ao lado.

### Critérios de aceite
- Cada fórmula de % gordura tem teste com valor calculado à mão a partir da fórmula publicada
  (mesmo padrão de `energy.test.ts`).
- Percentis/escore-z conferem com as tabelas oficiais da OMS em pontos de controle.
- Nenhuma avaliação antiga some ou muda de valor.

### Riscos
- **Correção científica (ALTO):** fórmula errada gera laudo errado. Cada protocolo cita a fonte no
  código e na tela, tem teste e é revisado pela nutricionista antes de fechar o bloco.
- **Tamanho:** é a maior fase do roadmap. Os blocos A → D são entregues e testados em separado.

---

## PHASE 16 — Cálculo energético · `DONE` (01/10/2026, publicada 01/10/2026) · `HIGH`

Nova aba no paciente, **ao lado de Antropometria**.

**Lista aprovada em 01/10/2026 (decisão R5):** ver `docs/FASE_16_FORMULAS.md` (montada a partir do
WebDiet). Mesma tela do WebDiet, salva ao abrir, comparação lado a lado, Henry & Rees (1991) e
Henry/Oxford (2005). **Gestantes e lactantes ficam para a fase própria de gestantes** (agora só o
adicional digitado à mão).

```
[x] Tela: "Importar de antropometria" escolhe a avaliação → peso, altura e massa magra; idade e sexo do cadastro
[x] Escolhe a fórmula, o fator de atividade e o fator injúria (as EER usam o próprio nível de atividade)
[x] Fórmulas adultos: Harris-Benedict 1919 e 1984, Mifflin-St Jeor (e por MLG), FAO/OMS, Henry & Rees,
    Henry/Oxford, Cunningham, Katch-McArdle, EER/IOM 2005, EER 2023, Tinsley (peso e MLG) — Bloco A
[x] Crianças/adolescentes: EER/IOM 2005, EER 2023, FAO/OMS, Schofield (peso e altura), Henry/Oxford
[x] Gestantes/lactantes: só o adicional digitado à mão (fórmulas ficam para a fase de gestantes)
[x] Comparar fórmulas lado a lado na mesma tela (clique escolhe a fórmula)
[x] Salvar o cálculo com nome e data (salva ao abrir e sozinho); GET recalculado no servidor (migration 0042)
[x] "Outro/sem sexo" continua nunca sendo assumido (regra da Fase 4)
[x] Ajustes: MET (atividade, MET e minutos por dia), meta de peso (VENTA, 7.700 kcal/kg)
[x] Lista de atividades do Compendium (2024, 1.111 atividades, tradução do AuriNutri) na busca do MET
[x] Tela refeita no formato do WebDiet (01/10/2026): caixas de 3 em 3, ajustes em janelas, VENTA com barras
```

### Critérios de aceite
- [x] Cada fórmula tem teste com valor de referência: sempre que possível, os exemplos publicados nas
  próprias fontes (folheto das DRIs 2023, 16 valores da tabela da IOM 2005, exemplo da FAO 2004, EAR
  do SACN 2011 para Henry/Oxford); as demais conferidas à mão. 42 testes em `energy-formulas.test.ts`.
- [x] A lista final de fórmulas foi aprovada pela nutricionista antes de implementar (R5, 01/10/2026).

**Como ficou (01/10/2026, commits b8745a2 → f3d8662, publicados):**
- Fórmulas em `src/lib/energy-formulas.ts`; fontes de cada coeficiente em `docs/FASE_16_FORMULAS.md`.
  Achado da pesquisa: duas fontes publicadas (diretriz ESPGHAN/ESPEN e uma revisão do PMC) trocam
  meninos e meninas na tabela de Schofield só com peso (10–18 anos); vale a da FAO.
- Migration **0042** (aplicada): `energy_calculations`, RLS exigindo que o paciente seja do próprio
  profissional, soft delete por função, auditoria. Entrou no backup, na exclusão de conta, na
  exportação LGPD e no teste de isolamento (que ainda não foi rodado com a tabela nova). O backup
  também passou a incluir `anthropometric_attachments`, que faltava desde a Fase 15.
- Tela no formato do WebDiet: caixas de 3 em 3, ajustes em janelas (MET com busca e lista completa,
  VENTA com barras de arrastar, gestante), resultados ao vivo e comparação de todas as fórmulas.
- Lista do MET: 2024 Adult Compendium, 1.111 atividades (`src/lib/compendium/atividades.ts`, gerado
  do PDF oficial; METs conferidos sem nenhuma diferença). Tradução para o português feita pelo
  AuriNutri (não existe oficial); uso comercial permitido pelos autores com citação.

**Pendências:**
- Comparar 2 ou 3 pacientes reais com o WebDiet, principalmente os **fatores injúria** (copiados do
  WebDiet; o artigo de Long, 1979, não é de acesso livre).
- Rodar `test:security-isolation-full` com a tabela nova.
- Avisar os autores do Compendium (compendiumpa@gmail.com) sobre a tradução, antes do lançamento.
- Identidade visual da tela fica para a Fase 19.

---

## PHASE 17 — Plano alimentar 2.0 · `EM ANDAMENTO` · `CRITICAL`

**Lista aprovada em 01/10/2026 (decisão R7):** `docs/FASE_17_PLANO.md`. Medidas caseiras: tabela
de medidas referidas do IBGE (POF 2008–2009, ftp.ibge.gov.br) ligada aos alimentos da TACO; a tabela de
composição do IBGE não entra (é compilação, com valores da USDA). TBCA 7.3 só com autorização de uso
comercial (R1). Resumo fixo no rodapé; só "Por alimentos";
micronutrientes × DRI entram. Periodização aguarda explicação da responsável.

**Bloco A (01/10/2026, local, aguardando teste):** migration 0043 (`planejamento_*` em `meal_plans`; o
resultado continua em `meta_*`), `src/lib/meal-planning.ts` (+9 testes), janela "Referências de cálculos
energéticos" (importar da aba Cálculo energético, g/kg ou % do GET) e cartão "Análise de nutrientes do
cardápio" (Prescrito × Teórico × Diferença, carboidratos livres, kcal não proteica/g N, densidade calórica,
barra de distribuição calórica). A "Calculadora de gasto energético" antiga saiu do plano. Corrigido junto:
consultas de "último peso" ignoravam avaliações sem peso só no papel (a edição da Fase 15 tinha falhado).

**Bloco B, início (01/10/2026, a pedido depois do teste do A):** tela do plano compacta e centralizada
(`max-w-5xl`); cada refeição numa linha fechada como no WebDiet (horário, nome, P/L/C, kcal, Abrir,
Editar, Duplicar — nova `duplicateMeal`, copia snapshot e substituições —, Favoritar = refeição
favorita, Excluir); o cartão "Total diário do plano" saiu e entrou o resumo fixo no rodapé
(`PlanSummaryBar`, prescrito / meta). Cores de P/L/C num lugar só (`src/lib/macro-colors.ts`).

**Parou aqui (01/10/2026, commit 5c33efa, publicado). Falta da Fase 17:**
```
[ ] Teste da responsável: Bloco A + tela compacta
[x] Bloco B (resto, 02/10): arrastar refeições pela alça ou com as setas (`MealList`, `reorderMeals`),
    "reordenar por horário" (`reorderMealsByTime`), "expandir/recolher tudo", "Ver anamnese" (aba nova);
    2.5 "salvar sozinho" já atendido: cada ação da tela do plano grava na hora
[x] Bloco C (02/10): refeição aberta com busca + filtros (`meal-food-search.ts`, `MealFoodSearch`;
    clicar adiciona na porção de referência), favoritos (migration 0044 `food_favorites`), cadastrar
    alimento sem sair (FoodFormDialog), `MealAnalysis` (densidade calórica, Ledikwe 2005, +2 testes),
    observações em texto formatado com salvamento automático (`atualizarObservacoesRefeicao`, PDF via
    `observacaoParaPdf`, +1 teste). Sai o formulário antigo (add-meal-item-form, recipe-combobox).
    "Medida usual" na busca fica para o Bloco D.
[x] Bloco D (02/10; 0045 aplicada, `npm run import:medidas` rodado: 1.922 medidas; E2E 17/17 com
    locators `.filter({ visible: true })` — o cartão do celular agora repete os rótulos; isolamento 109/109): migration 0045
    (`food_measures` IBGE com user_id nulo + do profissional, RLS; meal_items e substituições ganham
    medida_nome/medida_gramas/medida_quantidade como snapshot); ligação TACO→IBGE revisada à mão em
    `scripts/import-medidas/medidas-ibge-taco.json` (315 alimentos, 1.922 medidas; geradores em
    `gerar/`, ver README); `MealItemQuantity` (gramas ou medida + criar/excluir medida própria),
    busca adiciona na `medidaUsual`, PDF via `quantidadeDoItem` (+9 testes, 431 no total);
    duplicatePlan copia a medida; isolamento ganhou food_measures; E2E cria medida própria.
    Substitutos em medida caseira ficam para o Bloco E (colunas já existem). Modelos de refeição
    (meal_template_items) seguem só em gramas.
[x] Bloco E (02/10, local): `MealItemSubstitutionsDialog` refeito — tabela Original × substitutos com
    diferenças, critério kcal/CHO/PTN (`src/lib/substitutions.ts`: gramasEquivalentes,
    arredondarQuantidade de ½ em ½ medida, pontuacaoSugestao = diferença de macros relativa + 0,25·|log2
    peso| − 0,1 mesmo alimento-base, ehIngrediente, mesmoEstado; +13 testes), `sugerirSubstitutos` (mesma
    categoria TACO, até 6, peso entre ¼ e 4× o original), `inverterSubstituto` (troca snapshot + medida;
    receita não inverte), substituto em medida caseira (`food-measures-db.ts` compartilhado), PDF
    "Opções de substituição" (plan-pdf-data `substituicoes`, +1 teste). Unitários 444, E2E 17/17 (o de
    plano agora adiciona sugestão e inverte). Antes os substitutos nem saíam no PDF.
[x] Bloco F (02/10, local; 0046 aplicada — 27 de 31 itens com micros, todos os da TACO; E2E 17/17, isolamento 109/109): migration 0046 (23 micros + valores_especiais +
    micros_copiados em meal_items e substituições; itens antigos da TACO preenchidos da TACO). DRI:
    `src/lib/dri-tabela.ts` GERADO de NASEM 2019 Appendix J (`scripts/dri/`), `src/lib/dri.ts`
    (faseDaVida, avaliarAdequacao ±20%, UL/CDRR, nutrientesDoCardapio), `somarMicrosDosItens` (sem dado ≠ 0,
    traço = 0), docs/FASE_17_DRI.md. UI: MicronutrientsDialog, ShoppingListDialog (`listaDeComprasDoPlano`,
    receitas pelos ingredientes, `src/lib/shopping-list.ts`), PdfOptionsDialog → /planos/[id]/pdf?estilo=
    lista&nutrientes=1&compras=1&dias=7&quebra=1&condicao=…; PDF ganhou páginas de nutrientes e compras.
    Corrigido: regex de observação HTML no PDF (`[sS]` → `[\s\S]`, desde o Bloco C). Unitários 458.
[x] Bloco G (02/10; 0047 aplicada; E2E 18/18, isolamento 111/111; Blocos D–G publicados juntos): migration 0047 (meal_plans.favorito, .ordem). MealPlanList
    refeita (kcal via `kcalDoPlano`, kcal/kg com planejamento_peso_kg ou último peso, ações na linha,
    setas → `reordenarPlanos`, `ordenarPlanos` nulos primeiro), `alternarPlanoFavorito`,
    NewMealPlanDialog Em branco | De um modelo (`listarModelosDePlano`, `previaDoModelo`,
    `criarPlanoDeModelo` — sem planejamento teórico), `createMealPlan` cria Café da manhã/Almoço/Jantar.
    `src/lib/plan-copy.ts` (`copiarRefeicoes`, todas as colunas) usado por duplicar e modelo — corrige:
    duplicar plano não copiava substitutos. Isolamento +2 (modelos). E2E novo plano-modelo.e2e.ts.
[x] Periodização (print de 02/10): no WebDiet, "Escolher datas da periodização" deixa o plano visível
    para o paciente no app só dentro de uma faixa de datas. Depende do portal do paciente (Fase 8,
    adiado) → depois, junto com ele.
[ ] Responsável: testar Blocos D–G; enviar o e-mail de licença da TBCA
[x] 02/10: test:e2e 17/17 (rodado com E2E_BASE_URL=http://localhost:3000 contra o dev já ligado; corrigidos
    receita.e2e — busca nova — e avaliacao.e2e — seção de dobras começa fechada desde 01/10);
    test:security-isolation-full 104/104 (+energy_calculations, +food_favorites)
[x] Conferido: meal_items não tem colunas de micronutrientes (só macros); duplicatePlan copia tudo
    que o item tem. Guardar micros no item entra no Bloco F (micros × DRI).
```

### Bloco A — "Adicionar um planejamento" (substitui "Calculadora de gasto energético")
```
[ ] Importar um cálculo salvo na Fase 16 (escolhendo a data)
[ ] Campos editáveis: peso atual, GET, proteínas, lipídios, carboidratos
[ ] Distribuição por % do GET ou por fórmula de bolso (g/kg de peso corporal), com conversão automática
[ ] Grava nas metas do plano (colunas da migration 0007 + as novas)
```

### Bloco B — Painel sempre visível enquanto monta o plano
```
[ ] Computador: painel fixo à direita das refeições com planejado × prescrito
    (kcal, PTN, LIP, CHO em g, % e g/kg), com barra de adequação
[ ] Celular: barra fina fixa no rodapé só com os números; toque abre o painel completo
[ ] Botão "Gráfico de nutrientes": gráfico do cardápio inteiro (macros + micronutrientes principais)
```
**Decidido (25/09/2026):** painel à direita no computador e barra no rodapé no celular. Pode ser
revisto depois do uso real.

### Bloco C — Quantidade + medida caseira
```
[ ] Ao adicionar alimento: "Quantidade" + "Medida" (gramas, ml, unidade, fatia, colher de sopa,
    colher de sobremesa, colher de chá, xícara, copo, concha, escumadeira, porção...)
[ ] Cada medida tem equivalência em gramas por alimento (medidas das tabelas quando houver; o
    profissional pode cadastrar/ajustar a sua)
[ ] O snapshot do item grava quantidade, medida E gramas equivalentes (a regra do snapshot continua)
[ ] PDF mostra "2 fatias (50 g)"
```

### Bloco D — Substitutos com comparação
```
[ ] Botão "Substitutos" em cada alimento → buscar alimento → comparação lado a lado
    (kcal, PTN, LIP, CHO, fibras) com sugestão de quantidade equivalente (já existe por kcal)
[ ] Escolher o critério de equivalência (kcal, carboidrato, proteína)
```

### Bloco E — Busca de alimentos com filtro por fonte
```
[ ] Filtros: Todos, Favoritos, Receitas, Meus alimentos, TACO (+ TBCA 7.3 e Tucunduva quando a Fase 18 liberar)
[ ] Favoritar/desfavoritar alimento (tabela nova + RLS)
[ ] Receitas aparecem na mesma busca (hoje têm combobox próprio)
```

### Critérios de aceite
- Totais do painel = totais do PDF = totais da tela (mesmo teste da Fase 4, estendido).
- Plano antigo, só em gramas, continua abrindo e calculando igual.

---

## PHASE 18 — Tabelas de alimentos (TBCA 7.3, Tucunduva) · `BLOCKED` · `MEDIUM`

**Bloqueada pela decisão D3** (licenciamento), que a nutricionista está pesquisando.

Como entra, tecnicamente, depois de liberada:
```
[ ] Obter os dados em formato estruturado (planilha/arquivo oficial ou autorizado, nunca raspagem do site)
[ ] Script de importação no mesmo padrão de scripts/import-taco (idempotente, via service role, local)
[ ] Ampliar `fonte` ('taco' | 'personalizado') para os novos valores + rodapé de atribuição
    (buildFonteFooter) com a citação exigida por cada tabela
[ ] Importar medidas caseiras das tabelas quando existirem (alimenta a Fase 17 Bloco C)
[ ] Filtro por fonte já estará pronto (Fase 17 Bloco E): só entram os novos valores
```

**Opção anotada em 01/10/2026 — USDA FoodData Central** (a decidir junto com a resposta da USP sobre a
TBCA): domínio público (CC0), uso comercial livre com citação; API gratuita com chave (1.000
consultas/hora) e download da base inteira. Não serve como fonte principal (alimentos e marcas
americanos, nomes em inglês, medidas em unidades americanas). Serviria como **complemento** para
alimentos que faltam na TACO e são comuns em consultório (quinoa, chia, whey, industrializados):
importar uma seleção traduzida, com a fonte "USDA" marcada em cada alimento.

**TBCA (01/10/2026):** o site diz que uso comercial exige contato com os coordenadores e que não é
permitida a reprodução total ou parcial. E-mail de pedido de licença redigido; a responsável envia pelo
e-mail do AuriNutri para tbca.contato@usp.br.
**Resposta da USP (02/10/2026):** ainda não formalizam autorização para apps/softwares. A Procuradoria
Geral e a Agência USP de Inovação estão analisando os direitos sobre os dados e a marca TBCA para criar
um modelo institucional (licenciamento ou outra forma), sem previsão. Avisarão quando houver definição.
Até lá a TBCA não entra no AuriNutri.
**Resposta enviada (02/10/2026):** interesse em adquirir a licença (inclusive paga) nos termos que a USP
definir, compromisso de não usar os dados até a autorização e pedido para ser avisado. Contexto: em 2019 a
USP vendia licença paga para uso da base em outras ferramentas (Jornal da USP, 30/08/2019) — provável
origem do uso pelo WebDiet.

**USDA (decidido 02/10/2026):** entra já, traduzida, com bastante opção — inclusive alimentos que já
existem na TACO, para o nutricionista escolher a fonte. Ficam fora só os tipicamente americanos (fast-food,
marcas, alimentos indígenas do Alasca, papinhas, pratos prontos, caça, graus comerciais da carne).
SR Legacy (abril/2018): nomes adaptados ao jeito brasileiro/modelo TACO (pedido de 02/10: "só traduzir
causa confusão") por scripts/import-usda/padronizar.mjs; variações americanas juntadas em uma só →
4.356 alimentos (de 7.793). Base: dicionário de partes
(scripts/import-usda/traducao/), planilha de revisão scripts/import-usda/revisao-usda.xlsx. Revisão aprovada em 02/10/2026. Código pronto: migration 0048 (fonte usda em foods,
snapshots e food_measures; foods.codigo_usda), filtro USDA na busca, selos e citação no PDF por fonte
(buildFonteFooter), página Fontes, medidas caseiras traduzidas (scripts/import-usda/medidas.mjs) e
`npm run import:usda` (simula; `-- --gravar` grava). Concluído em 02/10/2026: 0048 aplicada, 4.356 alimentos + 4.041 medidas importados, E2E 19/19,
isolamento 111/111.

**Tucunduva (02/10/2026):** obra *Tabela de Composição de Alimentos: Suporte para Decisão Nutricional*
(Profa. Sonia Tucunduva Philippi, FSP-USP; Editora Manole, 8ª ed. 2023). Comprar o livro não dá direito
de usar os dados em software — precisa licença. A autora já licenciou a base para software (Virtual Nutri
Plus). Pedido de licença enviado a falecom@manole.com.br em 02/10/2026 (base em arquivo digital, condições,
valor, forma de citação). Resposta automática: responsável (vendas) de férias até 05/10. Sem retorno até
~16/10: ligar (11) 4196-6000 e pedir o setor de direitos autorais.
**Versão da TBCA (decidido 25/09/2026):** só a **TBCA 7.3**, a versão atual. Ela aparece no filtro
como uma única fonte; versões antigas não entram.

**O que já se sabe:** a TACO autoriza reprodução com citação. A **Tucunduva** é um livro comercial, e
colocar os dados dela num SaaS pago provavelmente exige licença da editora/autora. A **TBCA** tem termos
próprios que ainda não foram verificados. Isso é assunto jurídico, não de engenharia.

---

## PHASE 19 — Identidade visual e design · `IN PROGRESS` (desde 02/10/2026) · `MEDIUM`

```
[x] Logotipo: logo oficial (A + folha) adotada em 02/10/2026, recortada em public/brand/
    (símbolo + completa) e src/app/icon.png; slogan só no login/materiais
[ ] Carimbo personalizável: o profissional escolhe o que aparece (nome, CRN/UF, especialidade,
    assinatura, contato), a disposição e o estilo, com pré-visualização ao vivo
[ ] Carimbo aplicado nos PDFs que hoje levam assinatura (plano, recibo, evolução)
[ ] Revisão de design do sistema inteiro: tipografia, espaçamentos, cores, ícones, estados vazios
[ ] Aplicar a mesma identidade nos PDFs (plano, evolução, recibo)
[ ] PDFs "Relatório" e "Evolução" da antropometria (Fase 15): manter a organização, mas com cara
    própria do AuriNutri — hoje estão quase idênticos aos do WebDiet (pedido de 30/09/2026)
```
**Bloco A — design system (publicado 02/10/2026, E2E 18/18; falta revisão tela a tela, PDFs e carimbo):** tokens centralizados em `globals.css`
+ `tailwind.config.ts` (paleta oficial #07583F/#063F31/#78C51C/#A5D51F/#FF8A00, fundo #F8FAF9),
componentes base (Button/Card/Input/Select/Textarea/Badge), StatCard/PageHeader, sidebar em grupos,
hierarquia do painel. Nenhuma função, rota, ação ou consulta muda. A 19 começou antes da 18
(bloqueada por R1).
Painel refeito no layout de referência do usuário (02/10/2026): agenda só de hoje (consultas + tarefas;
minicalendário de 7 dias sai do painel), tendências "+N este mês"/"% vs mês anterior" + minilinha de 6 meses
(src/lib/dashboard.ts, com testes), sem busca global, sino "Em breve", banner "Dica do AuriNutri"
(src/lib/dashboard-dicas.ts; foto Unsplash de Calvin Shelwell em public/brand/banner-prato.jpg).
Fundo do sistema passa a #F0F6F4 (medido no print); painel ocupa a altura da tela no breakpoint `desk`
(≥1024 de largura e ≥700 de altura), com listas rolando por dentro; abaixo disso a página rola.
Agenda refeita (02/10/2026, publicada, E2E 18/18; + Confirmar/Cancelar no painel e escolha consulta/pacote/tarefa ao clicar no espaço vazio): números do topo (src/lib/agenda-stats.ts, com testes), calendário
do mês em pílulas, painel lateral com o dia selecionado + detalhes da consulta (Ficha/Editar/Remarcar);
clicar no dia seleciona (não cria mais consulta); semana começa na segunda (getWeekDays); a janela
"dia" (day-detail-dialog) foi substituída pelo painel.
Perfil do paciente refeito (04/10/2026, local): cabeçalho (avatar 96px + bolinha ativo/inativo via
`patients.ativo`, idade e objetivo, folhas ProfileLeaves), "Editar dados" como botão principal, "Enviar"
sem menu (abre a Central de Envio), abas em faixa branca com sublinhado (classes só no PatientTabs, o
`ui/tabs` global não mudou), Informações gerais em cartões com ícone, `formatTelefone` em src/lib/utils.ts
(só exibição, com testes), Objetivo com montanha (GoalMountain) e Observações. Conteúdo das demais abas
espera a referência de cada uma. Aba Planos alimentares (MealPlanList) no layout de referência: título + "Novo
plano" na mesma linha, ícone por plano, etiqueta Ativo em pílula com bolinha, divisória e ações maiores.
Tela do plano (/planos/[id]) no layout de referência: cabeçalho do paciente virou componente compartilhado
(PatientProfileHeader, também na ficha) e as abas viraram PatientTabLinks (links com ?aba=); ações do plano
no topo (MealPlanActions, secundárias num menu "..."), título do plano (MealPlanTitle) com kcal, kcal/kg e
status; refeição (MealCard) em linha larga clicável com ícone pelo nome, chips de macro e seta (rótulo
"Abrir <refeição>" mantém o E2E); análise de nutrientes "do plano" com diferenças em verde/vermelho suaves.
Nome e horário da refeição editáveis na própria linha (inputs + useAutoSave, 800 ms; horário só salva
completo ou ao sair do campo; nome em branco volta ao último salvo; Enter confirma, Esc desfaz); a janela
"Editar refeição" (lápis) saiu por ficar redundante. E2E lê os nomes pelos campos (nomesDasRefeicoes).
Nada de cálculo, banco ou ação mudou. "Ajustes rápidos" do mockup não existe e não foi criado.
Janela "Editar refeição" (04/10/2026, local; E2E 19/19): clicar na refeição abre MealEditorDialog (busca
MealEditorSearch, linhas MealEditorItem com substitutos em acordeão, MealEditorSummary com rosca). Decisão do
usuário: salvar só no botão. Rascunho puro em src/lib/meal-draft.ts (com testes); salvarRefeicao
(src/lib/actions/meal-editor.ts) grava tudo de uma vez — cada linha diz a fonte da cópia nutricional
(linha gravada, outra linha da refeição após "usar este", alimento ou receita) e o servidor copia de lá;
itens tirados seguem em soft delete; substitutos tirados são apagados. Sem migration. Aviso de saída
reaproveita useUnsavedChangesWarning. Ações por item antigas (meal-items.ts, meal-item-substitutions.ts,
atualizarObservacoesRefeicao) e a tela antiga (MealFoodSearch, MealItemRow/Card, dialog de substitutos)
foram removidas; sugestões rápidas ficaram em src/lib/substitution-suggestions.ts. Busca ganhou o filtro
"alimentos" (todas as fontes, sem receitas). FoodThumb aceita imagem opcional (hoje nenhum alimento tem). Depois do teste do usuário: resultados voltaram a ser lista (estrela, nome+origem,
qtd., PTN/LIP/CHO, kcal, +) e a busca de substituto usa a mesma lista com Todos/TACO/USDA/Meus alimentos
(o FoodCombobox antigo cortava em 8 globais em ordem alfabética e escondia a USDA).
Gravação atômica (pedido do usuário, 04/10): migration 0049 cria a função salvar_refeicao (security
invoker — RLS vale; lixeira via soft_delete_meal_item): refeição, substitutos tirados, itens tirados e itens +
substitutos numa transação só. test-security-isolation-full ganhou 3 checagens (B não salva a refeição de A;
A salva; erro no meio desfaz tudo). 0049 aplicada em 04/10; isolamento 114/114 e E2E 19/19.

**Por que no fim:** as telas de antropometria, cálculo energético e plano alimentar vão ser refeitas
nas Fases 15–17. Redesenhar antes seria refazer o design duas vezes. O design fecha o Roadmap 2
**antes** das testadoras, porque a primeira impressão delas conta.

---

## Ordem recomendada

```
12 Segurança e velocidade
 → 13 Ajustes rápidos
 → 14 Anamnese livre
 → 15 Antropometria → 16 Cálculo energético → 17 Plano alimentar 2.0   (cadeia: cada uma alimenta a próxima)
 → 19 Design
 → [fim do Roadmap 2 · uso no próprio consultório → convidar testadoras]
18 Tabelas de alimentos: entra em qualquer ponto depois da 17, assim que D3 for resolvida.
```

---

## Para corrigir (anotado em 02/10/2026)

- **Busca de alimentos do plano esconde resultados:** filtro USDA + "leite" mostra até batata, mas não
  "Leite, de vaca, integral". Pista: `buscarAlimentosRefeicao` usa `ilike %termo%` + `order(nome)` +
  `limit(30)`, então nomes que só contêm o termo ("Batata, amassada, com leite...") ocupam as vagas.
  Corrigir priorizando quem começa com o termo.
- **TACO com valores zerados:** ex. "Leite, de vaca, integral" todo em 0. Pente fino na importação da
  TACO (scripts/import-taco) e conferência de todos os alimentos.

## Decisões pendentes

| # | Decisão | Bloqueia | Quem decide |
|---|---|---|---|
| R1 | Licença de TBCA 7.3 e Tucunduva (antigo D3). TBCA: resposta da USP em 02/10/2026 — ainda não autorizam uso em software; Procuradoria Geral + Agência USP de Inovação definindo modelo institucional (provável licenciamento), sem prazo. Interesse em licença (inclusive paga) enviado em 02/10/2026; aguardar contato (tbca.contato@usp.br). Tucunduva: pedido enviado à Editora Manole em 02/10/2026, aguardando resposta | Fase 18 | Nutricionista / jurídico |

### Decididas em 01/10/2026
- **R7 — Plano alimentar 2.0:** lista aprovada em `docs/FASE_17_PLANO.md`; medidas caseiras do IBGE
  (POF 2008–2009) ligadas à TACO; resumo no rodapé; micronutrientes × DRI.
- **R5 — Gasto energético:** lista aprovada em `docs/FASE_16_FORMULAS.md`. As fórmulas do WebDiet
  para adultos e crianças, + Henry/Oxford (2005), + comparação lado a lado. Gestantes e lactantes
  ficam para a fase de gestantes.

### Decididas em 30/09/2026
- **R4 — Antropometria:** lista aprovada em `docs/FASE_15_PROTOCOLOS.md`. Mesmos protocolos do
  WebDiet (Pollock 3 e 7, Petroski, Guedes, Durnin, Faulkner) + Brozek **e** Siri à escolha, IMC de
  idosos por Lipschitz (1994), RCEst incluída, peso/altura e percentis para crianças. **Adiados:**
  acompanhamento de gestantes (fase própria, depois) e desenhos de onde medir. Body3D não entra.

### Decididas em 25/09/2026
- **R2 — TBCA:** usar só a TBCA 7.3 (versão atual).
- **R3 — Modelos de anamnese:** o próprio profissional cria os seus. O AuriNutri também oferece
  modelos prontos, que podem ser usados direto ou copiados e editados.
- **R6 — Logo e carimbo:** logo já atende (substituída pela logo oficial em 02/10/2026). O carimbo passa a ser personalizável (Fase 19).
- **Painel do plano:** fixo à direita no computador, barra no rodapé no celular (Fase 17).
