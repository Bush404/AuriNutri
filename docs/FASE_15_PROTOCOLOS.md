# Fase 15 — Lista de protocolos para aprovação (decisão R4)

> **APROVADA em 30/09/2026.** Decisões: gestantes **depois** (fase própria); densidade → % gordura
> por **Brozek e Siri** (o profissional escolhe; Brozek é o padrão); **RCEst entra**; para crianças
> entram **peso/altura e percentis**; **desenhos de onde medir ficam para depois**; Body3D não
> entra. Todo o resto da lista fica como proposto. Itens ⚠️ ainda não vistos no WebDiet usam a
> referência proposta na linha e são revisados pela nutricionista quando a tela estiver pronta.

Montada em 30/09/2026 a partir dos prints do WebDiet enviados pela responsável pelo produto,
com a referência científica de cada item. **Como marcar:** em cada linha, troque `[ ]` por
`[x] fica`, `[x] sai` ou escreva o que falta. Itens com ⚠️ não apareceram nos prints e precisam
ser confirmados no WebDiet (ou decididos por você).

Nada de código começa antes desta lista ser aprovada.

---

## 1. Tipos de avaliação (tela "Nova avaliação")

| # | Tipo | No WebDiet | Decisão |
|---|---|---|---|
| 1.1 | Adultos e idosos | Sim | [ ] |
| 1.2 | Crianças e adolescentes (bloqueia acima de 19 anos / 228 meses, recomendação OMS) | Sim | [ ] |
| 1.3 | Anexar relatório externo (PDF, JPG...) | Sim | [ ] |
| 1.4 | Avaliação por fotos Body3D | Sim — recurso próprio deles, depende de tecnologia de imagem. **Sugestão: não entra.** | [ ] |
| 1.5 | Gestantes — acompanhamento de ganho de peso | Sim, mas **não** é um tipo de "Nova avaliação": é uma aba separada ("iniciar acompanhamento gestacional"). Detalhes na seção 7. Não está no nosso roadmap. | [ ] |

Na lista de avaliações do paciente, cada uma tem: **Evolução · Relatório · Editar · Duplicar ·
Excluir**, e a data pode ser retroativa e editada depois. → Proposta: fazer igual (Duplicar é útil
para não redigitar tudo na consulta seguinte).

---

## 2. Adultos e idosos — medidas digitadas

### 2.1 Dados básicos
| Medida | Decisão |
|---|---|
| Peso (kg) | [ ] |
| Altura (cm) | [ ] |
| Altura sentado (cm) ⚠️ — o print não mostra para que é usada | [ ] |
| Altura do joelho (cm) — estima a altura de idosos/acamados | [ ] |
| "Paciente acamado? Clique aqui para estimar o peso" | [ ] |

### 2.2 Dobras cutâneas (mm) — 10 dobras
Tricipital, bicipital, abdominal, subescapular, axilar média, coxa, torácica (peitoral),
suprailíaca, panturrilha, supraespinhal. As dobras que o protocolo escolhido usa ficam
destacadas (barra vermelha). → [ ]

### 2.3 Circunferências (cm)
Pescoço, tórax, **ombro**, cintura, quadril, abdômen; e **dos dois lados** (esquerdo/direito):
braço relaxado, braço contraído, antebraço, coxa proximal, coxa medial, **coxa distal**,
panturrilha. Botão "inverter preenchimento". Preencher os dois lados é opcional (só comparativo).
→ [ ]

### 2.4 Diâmetros ósseos (cm)
Úmero, punho, fêmur. → [ ]

### 2.5 Bioimpedância (digitar o que o aparelho mostra)
% de gordura, massa gorda, % de massa muscular, massa muscular, massa livre de gordura, peso
ósseo, gordura visceral, água corporal, idade metabólica. → [ ]

### 2.6 "Habilitar imagem das medidas"
Mostra desenhos de onde medir cada ponto. → [ ] (exige ilustrações próprias — não podemos
copiar as deles)

---

## 3. Adultos e idosos — protocolos de % de gordura (dobras)

O WebDiet oferece exatamente estes 6 + "Nenhuma":

| # | Protocolo | Dobras | Fonte científica | Decisão |
|---|---|---|---|---|
| 3.1 | **Pollock 3** | Homem: peitoral, abdominal, coxa. Mulher: tríceps, suprailíaca, coxa | Jackson & Pollock, 1978 (homens); Jackson, Pollock & Ward, 1980 (mulheres) | [ ] |
| 3.2 | **Pollock 7** | Peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca, coxa | Mesmas fontes do 3.1 | [ ] |
| 3.3 | **Petroski** | Homem: subescapular, tríceps, suprailíaca, panturrilha. Mulher: axilar média, suprailíaca, coxa, panturrilha | Petroski, 1995 (tese, UFSM) — população brasileira | [ ] |
| 3.4 | **Guedes** | Homem: tríceps, suprailíaca, abdominal. Mulher: subescapular, suprailíaca, coxa | Guedes, 1985 — universitários brasileiros | [ ] |
| 3.5 | **Durnin & Womersley** | Bíceps, tríceps, subescapular, suprailíaca | Durnin & Womersley, 1974 | [ ] |
| 3.6 | **Faulkner** | Tríceps, subescapular, suprailíaca, abdominal | Faulkner, 1968 | [ ] |

**Densidade → % de gordura:** o WebDiet mostra "Percentual de Gordura (Brozek, 1963)".
Fonte: Brozek et al., 1963. → [ ] usar Brozek (alternativa comum: Siri, 1961 — ⚠️ quer as duas?)

---

## 4. Adultos e idosos — resultados calculados

| # | Resultado | Fonte provável | Decisão |
|---|---|---|---|
| 4.1 | IMC + classificação (adultos) | OMS, 1997/2000 | [ ] |
| 4.2 | **Classificação do IMC para idosos (60+)** — confirmado pelo print da paciente de 63 anos: IMC 36,9 aparece como "Sobrepeso" e a faixa ideal é 52,9–64,9 kg para 1,55 m (= IMC 22 a 27). Isso é **Lipschitz, 1994** (< 22 baixo peso, 22–27 eutrofia, > 27 sobrepeso), a mesma do SISVAN. Obs.: Lipschitz não tem categoria "obesidade" — um idoso com IMC 37 aparece só como "sobrepeso". | Lipschitz, 1994 | [ ] |
| 4.3 | Faixa de peso ideal — adulto: IMC 18,5 a 24,9 (conferi: 62,6–84,3 kg para 1,84 m); idoso: IMC 22 a 27 | OMS / Lipschitz | [ ] |
| 4.4 | RCQ (relação cintura/quadril) + risco metabólico | ⚠️ ponto de corte não aparece; o mais usado é OMS, 2008 (> 0,90 homem, > 0,85 mulher) | [ ] |
| 4.5 | **RCEst (cintura/estatura)** — **o WebDiet não tem** | Ashwell, 2012 (risco a partir de 0,5) | [ ] |
| 4.6 | CMB (circunferência muscular do braço, escolhendo o lado) + classificação | Fórmula: CB − π × DCT. ⚠️ Classificação provável: Frisancho, 1990 (percentis) / Blackburn & Thornton, 1979 (adequação) | [ ] |
| 4.7 | % de gordura, % ideal, classificação do % GC (**editável** pelo profissional) | ⚠️ tabela de classificação não aparece — confirmar qual é o padrão | [ ] |
| 4.8 | Peso de gordura e massa livre de gordura | Calculados a partir do % de gordura | [ ] |
| 4.9 | Peso ósseo (diâmetros) | Von Döbeln, 1964, modificada por Rocha, 1975 (punho + fêmur) | [ ] |
| 4.10 | Peso residual — confirmado: 88,7 kg × 20,9% = 18,5 kg na paciente mulher | Würch, 1974 (24,1% do peso no homem, 20,9% na mulher) | [ ] |
| 4.11 | Massa muscular | Peso − (gordura + ósseo + residual) — modelo de 4 componentes, De Rose & Guimarães, 1980 | [ ] |
| 4.12 | Somatório de dobras, densidade corporal, "Referência usada" | Mostra o protocolo escolhido. O WebDiet escreve "Pollock 3, 1978" no homem e "Pollock 3, 1989" na mulher; a fonte original da equação feminina é Jackson, Pollock & Ward, 1980 — no AuriNutri citaremos a original. | [ ] |
| 4.13 | Estimativa de peso de acamado | ⚠️ provável Chumlea, 1988 (altura do joelho, braço, panturrilha, subescapular) | [ ] |
| 4.14 | Altura estimada pela altura do joelho | ⚠️ provável Chumlea, 1985 | [ ] |
| 4.15 | Resultados da bioimpedância com classificação do % GC | Valores do aparelho | [ ] |
| 4.16 | "Ver gráficos" e "Ver evolução" | — | [ ] |

---

## 5. Crianças e adolescentes

| # | Item | Fonte (como aparece no WebDiet) | Decisão |
|---|---|---|---|
| 5.1 | Idade em anos e meses calculada automaticamente | — | [ ] |
| 5.2 | Peso/idade — gráfico de 0 a 10 anos | OMS, 2006/2007; faixas: Ministério da Saúde, SISVAN, 2008 | [ ] |
| 5.3 | Altura/idade — gráfico de 0 a 19 anos | Idem | [ ] |
| 5.4 | IMC/idade — gráfico de 0 a 19 anos | Idem | [ ] |
| 5.5 | Escore-z de cada um + legenda colorida (vermelho/amarelo/verde) | SISVAN, 2008 | [ ] |
| 5.6 | ⚠️ **Peso/altura (0–5 anos)** — **não aparece no WebDiet**, mas faz parte do SISVAN para menores de 5 | OMS, 2006 | [ ] |
| 5.7 | ⚠️ **Percentil** além do escore-z — o WebDiet só mostra escore-z | OMS | [ ] |
| 5.8 | % de gordura infantil (dobras tricipital + subescapular, ou tricipital + panturrilha) | Slaughter et al., 1988 | [ ] |
| 5.9 | Classificação do % de gordura infantil | Lohman, 1987 | [ ] |

**Um ponto de atenção que achei nos prints:** a legenda do IMC/idade do WebDiet usa os nomes da
faixa **5 a 19 anos** ("> +1 sobrepeso", "> +2 obesidade") para todas as idades. Para **menores de
5 anos**, o SISVAN usa outros nomes ("> +1 risco de sobrepeso", "> +2 sobrepeso", "> +3
obesidade"). → Proposta: o AuriNutri mostra a legenda certa para a idade. [ ]

---

## 6. Anexar relatório externo
Upload de PDF/JPG/PNG com data e observação; opcionalmente digitar os principais números para
entrarem na evolução. (Já estava no roadmap, Bloco C.) → [ ]

---

## 7. Gestantes — acompanhamento gestacional (como o WebDiet faz)

| # | Item | Fonte | Decisão |
|---|---|---|---|
| 7.1 | Início: peso pré-gestacional, altura, idade gestacional atual (semanas), data da última menstruação, tipo de gestação (única/gemelar) | — | [ ] |
| 7.2 | IMC pré-gestacional + classificação | OMS (a mesma do adulto) | [ ] |
| 7.3 | A cada semana: peso, dobra tricipital, circunferência do braço | — | [ ] |
| 7.4 | Resultados: IMC atual, ganho de peso, adequação do ganho, CMB, estado proteico, estado lipídico | ⚠️ fonte do estado proteico/lipídico não aparece | [ ] |
| 7.5 | Gráfico e tabela semana a semana (10 a 40 semanas) com peso mínimo e máximo recomendado e o peso registrado | **Gestação única: Caderneta da Gestante, 6ª ed., Ministério da Saúde, 2022** (curvas brasileiras de ganho de peso, Kac et al., 2021). **Gemelar: Luke, 2005; WHO, 1995** | [ ] |
| 7.6 | "Aporte calórico" por semana + botão "usar aporte" (manda para o cálculo energético) | Método VENTA: 1 kg de peso = 7.700 kcal | [ ] |
| 7.7 | "Ver conduta" por semana | ⚠️ texto de conduta não aparece nos prints | [ ] |

**Atenção no item 7.6:** no print, a paciente de 80 kg sem nenhum peso registrado aparece com
"+9.582 kcal/dia" na semana 10 e "+7.860 kcal/dia" na semana 12. São valores impossíveis de
usar na prática: somar ~9.500 kcal por dia ao plano. Parece que o WebDiet calcula mesmo sem ter
o peso atual, ou divide a diferença de peso por poucos dias. → Proposta: se entrar, o AuriNutri
só mostra o aporte depois de haver um peso registrado, e a própria nutricionista confere a regra
antes de implementarmos. [ ]

**Onde encaixar:** o roadmap hoje não tem gestantes na Fase 15 (só um "adicional energético, a
confirmar" na Fase 16). Opções: (a) vira um Bloco E da Fase 15; (b) fica para uma fase própria
depois da 16; (c) não entra. [ ]

---

## Resumo do que precisa da sua decisão
1. Gestantes: entram agora (Bloco E da Fase 15), depois, ou não entram? (seção 7)
2. ~~Classificação de IMC para idosos~~ — confirmado: Lipschitz, 1994 (4.2). Só confirme que fica.
3. Brozek só, ou Brozek + Siri? (seção 3)
4. RCEst entra, mesmo o WebDiet não tendo? (4.5)
5. Peso/altura e percentis para crianças entram? (5.6, 5.7)
6. Ilustrações de onde medir: agora ou depois? (2.6)
7. Ainda não visto no WebDiet (opcional conferir): ponto de corte do RCQ, classificação da CMB e
   do % GC, para que serve a "altura sentado", e a fonte do estado proteico/lipídico da gestante.
