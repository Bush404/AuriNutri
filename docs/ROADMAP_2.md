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
[ ] Checklist de contas administrativas: 2FA em Supabase, Netlify, GitHub, Resend, Sentry, registro do domínio
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

## PHASE 13 — Ajustes rápidos do dia a dia · `TODO` · `HIGH`

Tudo aqui mexe em telas que já existem, sem modelo de dados novo (exceto se indicado).

### Dashboard
```
[ ] Trocar o card "Ticket médio" por "Balanço dos últimos 30 dias" (recebido − despesas, período móvel)
[ ] Dividir a seção inferior em duas colunas:
      esquerda: minicalendário dos próximos 7 dias, só visualização, com botão "Ver agenda completa"
      direita:  "Próximos compromissos (7 dias)" = consultas + tarefas
[ ] No celular, as duas colunas empilham (calendário em cima)
```
Nome sugerido para a lista da direita: **"Próximos compromissos (7 dias)"**, porque junta consultas e
tarefas. "Próximas tarefas" daria a entender que as consultas sumiram.

**Regra de vocabulário (Fase 9):** "Balanço" é receita − despesa do período, e o card explica isso
em um tooltip. Os dados vêm de `payments`/`expense_occurrences`, que já existem.

### Tarefas (interface para o backend da Fase 5)
```
[ ] Criar tarefa pela agenda (título, data, horário opcional, paciente opcional, observação)
[ ] Tarefas aparecem no calendário com visual diferente das consultas
[ ] Concluir / reabrir / excluir tarefa
[ ] Tarefas entram em "Próximos compromissos" no dashboard
```
Tarefas **não** entram na trava de horário sobreposto (migration 0012 vale só para consultas).

### Anamnese: lista em vez de abrir a última
```
[ ] Ao entrar na aba: botão "Adicionar nova anamnese" no topo
[ ] Abaixo: anamneses anteriores fechadas (título/nome, data), com "Visualizar/editar" e "Excluir"
[ ] Excluir usa soft delete via função security definer (padrão obrigatório desde a migration 0017)
```

### Planos alimentares
```
[ ] Botões Editar, Excluir e Ativar/Desativar em cada plano da lista (actions já existem)
[ ] Busca de alimento: trocar "Buscar alimento (TACO ou seus)..." por "Buscar alimentos"
```

### Critérios de aceite
- Balanço de 30 dias confere com um cálculo feito à mão (teste unitário).
- Tarefa de uma conta não aparece para outra (acrescentar `tasks` ao teste de isolamento).
- Excluir anamnese não apaga do banco: some da tela e fica no audit_log.

---

## PHASE 14 — Anamnese em texto livre e modelos · `TODO` · `HIGH`

**Pedido:** deixar de ter caixas separadas por tema e virar uma página em branco estilo Word. Deve
ser possível importar um modelo próprio da nutricionista e só editar.

```
[ ] Editor de texto rico (negrito, listas, títulos, tabela simples); biblioteca a avaliar antes (ex.: Tiptap)
[ ] Nova coluna de conteúdo livre na anamnese; campos por tema antigos passam a ser só leitura
[ ] Migração: cada anamnese antiga é convertida em texto (título do tema + conteúdo), sem apagar colunas antigas
[ ] "Meus modelos de anamnese": o próprio profissional cria, edita e exclui os seus (tabela nova + RLS)
[ ] Modelos prontos do AuriNutri (globais, só leitura, mesmo padrão dos alimentos TACO):
    o profissional usa direto ou cria uma cópia editável nos "Meus modelos"
[ ] Conteúdo dos modelos prontos escrito com a nutricionista (ex.: adulto geral, esportivo,
    gestante, infantil) e revisado por ela antes de publicar
[ ] Nova anamnese: escolher "Em branco" ou um modelo (próprio ou pronto)
[ ] Colar texto vindo do Word mantendo a formatação básica (títulos, negrito, listas)
[ ] Anamnese no PDF / exportação LGPD continua funcionando com o novo formato
```

### Riscos
- **Perda de dados na migração (ALTO):** mesma garantia da migration 0006: nada é apagado nem
  sobrescrito, as colunas antigas continuam no banco e a conversão é testada antes, em uma cópia.
- **HTML salvo pelo editor (segurança):** todo conteúdo rico é limpo (sanitizado) antes de exibir, para
  impedir que um arquivo importado carregue código malicioso.

---

## PHASE 15 — Antropometria profissional · `TODO` · `CRITICAL`

**Por que crítica:** foi apontada como "de extrema importância" e hoje é a tela mais distante dos
softwares de mercado. Ela alimenta a Fase 16 (cálculo energético) e a Fase 17 (planejamento).

Ao clicar em "Nova avaliação", o profissional escolhe entre três tipos:

### Bloco A — Adultos e idosos
```
[ ] Peso, altura, IMC com classificação (OMS para adultos; faixa específica para idosos, a confirmar)
[ ] Circunferências completas (pescoço, tórax, cintura, abdome, quadril, braço relaxado/contraído,
    antebraço, punho, coxa proximal/medial, panturrilha)
[ ] Dobras cutâneas (tríceps, bíceps, subescapular, peitoral, axilar média, suprailíaca, abdominal,
    coxa, panturrilha)
[ ] Protocolos de % de gordura à escolha (ex.: Jackson & Pollock 3 e 7 dobras, Durnin & Womersley,
    Petroski, Guedes, Faulkner), calculando massa gorda e massa magra
[ ] Diâmetros ósseos (úmero, fêmur, punho) → peso ósseo / compleição
[ ] Bioimpedância: digitar os valores do aparelho
[ ] Idosos: altura estimada pela altura do joelho, circunferência da panturrilha
[ ] Indicadores derivados: RCQ, RCEst, com classificação de risco
```

### Bloco B — Crianças e adolescentes
```
[ ] Peso/idade, altura/idade, IMC/idade, peso/altura em percentil e escore-z
[ ] Curvas de crescimento OMS (0–5 anos e 5–19 anos) por sexo, com o ponto do paciente no gráfico
[ ] Idade calculada automaticamente a partir da data de nascimento e da data da avaliação
```

### Bloco C — Anexar relatório externo
```
[ ] Upload de PDF/JPEG/PNG (bioimpedância, DEXA, laudo) com data e observação
[ ] Opcional: digitar os principais números para entrarem na evolução
[ ] Reaproveita o padrão de bucket privado + validação de arquivo das Fases 7/10
```

### Bloco D — Evolução
```
[ ] Cada avaliação mostra seu próprio gráfico de evolução (todas as avaliações até aquela data)
[ ] Profissional escolhe até 5 indicadores para visualizar (peso, % gordura, massa magra, cintura...)
[ ] PDF "Evolução física" de qualquer data, com os 5 gráficos escolhidos, atualizado até a data
[ ] Avaliações antigas (formato atual) continuam aparecendo na evolução
```

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

## PHASE 16 — Cálculo energético · `TODO` · `HIGH`

Nova aba no paciente, **ao lado de Antropometria**.

```
[ ] Tela: escolhe a data/avaliação de origem → dados preenchidos (peso, altura, idade, sexo, massa magra)
[ ] Escolhe a fórmula e o fator de atividade (e fator injúria/térmico quando se aplicar)
[ ] Fórmulas adultos: Harris-Benedict, Mifflin-St Jeor (já existem), FAO/OMS, Schofield, Henry (Oxford),
    Cunningham e Katch-McArdle (usam massa magra da Fase 15), IOM/DRI (EER), Tinsley
[ ] Crianças/adolescentes: IOM/DRI (EER por faixa), Schofield, FAO/OMS
[ ] Gestantes/lactantes: adicional energético (a confirmar com a nutricionista)
[ ] Comparar fórmulas lado a lado na mesma tela
[ ] Salvar o cálculo com data (histórico): é daqui que o planejamento do plano importa
[ ] "Outro/sem sexo" continua nunca sendo assumido (regra da Fase 4)
```

### Critérios de aceite
- Cada fórmula tem teste com valor de referência calculado à mão.
- A lista final de fórmulas é revisada pela nutricionista antes de implementar.

---

## PHASE 17 — Plano alimentar 2.0 · `TODO` · `CRITICAL`

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
**Versão da TBCA (decidido 25/09/2026):** só a **TBCA 7.3**, a versão atual. Ela aparece no filtro
como uma única fonte; versões antigas não entram.

**O que já se sabe:** a TACO autoriza reprodução com citação. A **Tucunduva** é um livro comercial, e
colocar os dados dela num SaaS pago provavelmente exige licença da editora/autora. A **TBCA** tem termos
próprios que ainda não foram verificados. Isso é assunto jurídico, não de engenharia.

---

## PHASE 19 — Identidade visual e design · `TODO` · `MEDIUM`

```
[ ] Logotipo: já atende (Fase 2), só entra na revisão visual
[ ] Carimbo personalizável: o profissional escolhe o que aparece (nome, CRN/UF, especialidade,
    assinatura, contato), a disposição e o estilo, com pré-visualização ao vivo
[ ] Carimbo aplicado nos PDFs que hoje levam assinatura (plano, recibo, evolução)
[ ] Revisão de design do sistema inteiro: tipografia, espaçamentos, cores, ícones, estados vazios
[ ] Aplicar a mesma identidade nos PDFs (plano, evolução, recibo)
```
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

## Decisões pendentes

| # | Decisão | Bloqueia | Quem decide |
|---|---|---|---|
| R1 | Licença de TBCA 7.3 e Tucunduva (antigo D3) | Fase 18 | Nutricionista / jurídico |
| R4 | Lista final de protocolos de % gordura e classificações de idosos | Fase 15 | Nutricionista |
| R5 | Lista final de fórmulas de gasto energético (incluindo gestantes) | Fase 16 | Nutricionista |

### Decididas em 25/09/2026
- **R2 — TBCA:** usar só a TBCA 7.3 (versão atual).
- **R3 — Modelos de anamnese:** o próprio profissional cria os seus. O AuriNutri também oferece
  modelos prontos, que podem ser usados direto ou copiados e editados.
- **R6 — Logo e carimbo:** logo já atende. O carimbo passa a ser personalizável (Fase 19).
- **Painel do plano:** fixo à direita no computador, barra no rodapé no celular (Fase 17).
