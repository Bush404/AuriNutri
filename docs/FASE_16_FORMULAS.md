# Fase 16 — Lista de fórmulas para aprovação (decisão R5)

> **APROVADA em 01/10/2026.** Decisões: o cálculo é **salvo ao abrir e salva sozinho** (1.3);
> **comparar fórmulas lado a lado** entra, como tabela em que um clique escolhe a fórmula (1.9);
> **Henry & Rees (1991) e Henry/Oxford (2005)** entram as duas (2.10); **gestantes e lactantes
> ficam para a fase própria** de gestantes (seção 7), e agora só o adicional digitado à mão (6.3);
> lista de atividades do **MET** só se a licença do Compendium permitir, senão o profissional
> digita o MET e os minutos (6.1). HandyMET não entra. Todo o resto fica como proposto.

Montada em 01/10/2026 a partir dos prints do WebDiet enviados pela responsável pelo produto
(`C:\Users\Bush404\Pictures\webdiet calculos`), com a referência científica de cada item.

**Como marcar:** em cada linha, troque `[ ]` por `[x] fica`, `[x] sai` ou escreva o que falta.
Itens com ⚠️ têm uma dúvida ou sugestão minha na própria linha.

**Coeficientes:** esta lista só define **quais** fórmulas entram. Na hora de programar, cada
coeficiente é conferido na publicação original (não de memória — lição da Fase 15, em que a
memória do assistente estava errada em Petroski e em percentis da CMB) e ganha teste com um valor
calculado à parte.

Nada de código começa antes desta lista ser aprovada.

---

## 1. Como a tela funciona (igual ao WebDiet)

| # | Item | No WebDiet | Decisão |
|---|---|---|---|
| 1.1 | Aba "Cálculo energético" no paciente, **ao lado de Antropometria**, com a lista dos cálculos salvos (nome, total em kcal/dia, data) e **Editar · Duplicar · Excluir** | Sim | [ ] |
| 1.2 | Botão "Novo cálculo" pede um **nome** (ex.: "Dias de treino"), para reconhecer o cálculo depois, na hora de montar o plano | Sim | [ ] |
| 1.3 | ⚠️ O cálculo é **salvo ao abrir e salva sozinho**, como fizemos na antropometria hoje. (No WebDiet tem botão "salvar cálculos".) | Diferente | [ ] |
| 1.4 | **1. Dados antropométricos:** altura, peso e massa livre de gordura, com o botão "Importar de antropometria" (escolhe a avaliação pela data). Idade e sexo vêm do cadastro. | Sim | [ ] |
| 1.5 | **2. Fórmula** + **fator de atividade** + **fator injúria** | Sim | [ ] |
| 1.6 | **3. Ajustes refinados:** adicional por MET, meta de peso (VENTA), adicional de gestante (seção 6) | Sim | [ ] |
| 1.7 | **4. Resultados:** TMB e GET | Sim | [ ] |
| 1.8 | "Ver referências": para cada fórmula, um texto explicando para quem serve, que dados usa e as limitações | Sim | [ ] |
| 1.9 | ⚠️ **Comparar fórmulas lado a lado** com os mesmos dados (pedido do nosso roadmap; **não existe no WebDiet**). Sugestão: uma tabela "TMB e GET em todas as fórmulas que se aplicam", e um clique escolhe a fórmula | Não | [ ] |
| 1.10 | Paciente com sexo "outro" ou sem sexo: a base (masculino/feminino) **nunca é assumida**; o profissional escolhe, como na antropometria (regra da Fase 4) | — | [ ] |
| 1.11 | O cálculo salvo é o que o **planejamento do plano alimentar importa** na Fase 17 | — | [ ] |

---

## 2. Fórmulas para adultos e idosos

"MLG" = massa livre de gordura (vem da avaliação da Fase 15: protocolo de dobras ou bioimpedância).

| # | Fórmula | Usa | Para quem / observação | Referência | Decisão |
|---|---|---|---|---|---|
| 2.1 | Harris-Benedict (1919) | peso, altura, idade, sexo | Original. **Já existe no AuriNutri** (Fase 4) | Harris & Benedict, 1919 | [ ] |
| 2.2 | Harris-Benedict (1984) | peso, altura, idade, sexo | Revisão dos mesmos dados | Roza & Shizgal, 1984 | [ ] |
| 2.3 | FAO/WHO (2004) | peso, idade, sexo | Equações por faixa etária (as de Schofield) | FAO/WHO/UNU, 2004 (relatório de 2001) | [ ] |
| 2.4 | EER/IOM (2005) | peso, altura, idade, sexo, nível de atividade | ⚠️ Calcula o **GET direto** com o próprio coeficiente de atividade (PA). O fator de atividade e o fator injúria da tela não se aplicam | Institute of Medicine, 2005 (DRI) | [ ] |
| 2.5 | EER (2023) | peso, altura, idade, sexo, nível de atividade | Atualização das DRIs de energia. Mesma observação da 2.4 | National Academies, 2023 | [ ] |
| 2.6 | Katch-McArdle (1996) | MLG | Bom para quem tem composição corporal fora da média | McArdle, Katch & Katch, 1996 | [ ] |
| 2.7 | Cunningham (1980) | MLG | Muito usada para atletas | Cunningham, 1980 | [ ] |
| 2.8 | Mifflin-St Jeor (1990) | peso, altura, idade, sexo | **Já existe no AuriNutri** (Fase 4) | Mifflin et al., 1990 | [ ] |
| 2.9 | Mifflin-St Jeor por MLG (1990) | MLG | Equação de MLG do mesmo artigo | Mifflin et al., 1990 | [ ] |
| 2.10 | Henry & Rees (1991) | peso, idade, sexo | ⚠️ Feita para populações de **clima tropical**. O nosso roadmap falava em "Henry (Oxford, 2005)", que é outra equação, e **não está** no WebDiet. Qual entra: as duas, só uma ou nenhuma? | Henry & Rees, 1991 · Henry, 2005 | [ ] |
| 2.11 | Tinsley por peso (2018) | peso | Feita com **atletas** (fisiculturismo) | Tinsley et al., 2018 | [ ] |
| 2.12 | Tinsley por MLG (2018) | MLG | Idem | Tinsley et al., 2018 | [ ] |
| 2.13 | GET por fórmula de bolso | peso × kcal/kg | O profissional digita as kcal por kg | — | [ ] |
| 2.14 | Colocar TMB manualmente | — | Digita a TMB e aplica os fatores | — | [ ] |
| 2.15 | Colocar GET manualmente | — | Digita o GET final | — | [ ] |

**Schofield (1985) para adultos:** o WebDiet não lista com esse nome para adultos, porque as
equações da FAO/WHO (2.3) **são** as de Schofield. Sugestão: não repetir. → [ ]

---

## 3. Fórmulas para crianças e adolescentes

| # | Fórmula | Usa | Referência | Decisão |
|---|---|---|---|---|
| 3.1 | EER/IOM (2005) — infantil | peso, altura, idade, sexo, nível de atividade (inclui o gasto de crescimento) | Institute of Medicine, 2005 | [ ] |
| 3.2 | EER (2023) — infantil | idem, equações atualizadas | National Academies, 2023 | [ ] |
| 3.3 | FAO/WHO (2004) — infantil | peso, idade, sexo | FAO/WHO/UNU, 2004 | [ ] |
| 3.4 | Schofield (1985) — infantil | peso (e altura, na versão peso+altura), idade, sexo | Schofield, 1985 | [ ] |

⚠️ A tela usa o tipo da avaliação importada (adulto ou criança) e a idade para mostrar só as
fórmulas que se aplicam. → [ ]

---

## 4. Fator de atividade física (igual ao WebDiet)

| Valor | Nível | Decisão |
|---|---|---|
| 1,000 | Não utilizar | [ ] |
| 1,200 | Sedentário (pouco ou nenhum exercício) | [ ] |
| 1,375 | Leve (exercício leve, 1–3 dias/semana) | [ ] |
| 1,550 | Moderada (3–5 dias/semana) | [ ] |
| 1,725 | Intensa (6–7 dias/semana) | [ ] |
| 1,900 | Muito intensa (exercício diário muito intenso ou trabalho físico 2x ao dia) | [ ] |

Hoje o AuriNutri (Fase 4) já usa esses mesmos 5 níveis. Nas fórmulas EER (2.4, 2.5, 3.1, 3.2) o
nível de atividade entra dentro da própria equação, com outros coeficientes.

---

## 5. Fator injúria (listas do WebDiet)

⚠️ Os valores abaixo foram copiados dos prints do WebDiet. Na programação eles são conferidos
nas fontes originais, e o que divergir volta para você decidir.

**Lista "Harris-Benedict (1919)":** 1,000 paciente não complicado · 1,100 pós-operatório de câncer ·
1,200 fratura · 1,300 sepse · 1,400 peritonite · 1,500 multitrauma + reabilitação · 1,600
multitrauma + sepse · 1,250 queimadura até 20% · 1,700 queimadura 30–50% · 1,800 queimadura 50–70% ·
2,000 queimadura 70–90% · 2,100 queimadura 100%. → [ ]

**Lista "Long (1979)":** 1,270 câncer · 1,100 cirurgia eletiva · 1,500 desnutrição grave · 0,900 doença
cardiopulmonar · 1,420 doença cardiopulmonar com cirurgia · 1,270 fraturas múltiplas · 1,320 infecção
grave · 1,400 insuficiência cardíaca · 1,420 insuficiência hepática · 1,300 insuficiência renal
aguda · 0,900 jejum · 1,350 pós-operatório de cirurgia cardíaca · 1,550 pancreatite · 1,200 pequena
cirurgia · 1,250 pequeno trauma de tecido · 1,250 pós-operatório (geral) · 1,350 pós-operatório
torácico · 1,600 sepse · 1,350 transplante de fígado · 1,250 transplante de medula óssea. → [ ]

Referência: Long et al., 1979 (e a tabela clássica que acompanha Harris-Benedict na literatura
clínica).

---

## 6. Ajustes refinados

| # | Ajuste | Como funciona no WebDiet | Decisão |
|---|---|---|---|
| 6.1 | **Adicional por MET** | Busca uma atividade numa lista (ex.: "Aeróbico, em geral — MET 7,3"), digita os minutos, e o gasto entra no GET. ⚠️ A lista de atividades vem do *Compendium of Physical Activities* (Ainsworth et al.; versão atual de 2024). Preciso conferir se ele pode ser usado num software pago. Se não puder, o profissional digita o MET e os minutos | [ ] |
| 6.2 | **Meta de peso (VENTA)** | Quantos kg ganhar ou perder e em quantos dias → soma ou tira kcal por dia, contando **7.700 kcal por kg** (Valor Energético do Tecido Adiposo) | [ ] |
| 6.3 | **Adicional de gestante** | ⚠️ No WebDiet vem da aba "Acompanhamento gestacional" **ou** é digitado à mão. Nós ainda não temos o acompanhamento gestacional (adiado na Fase 15). Sugestão: **agora só a digitação manual**; o automático entra quando a fase de gestantes for feita | [ ] |

---

## 7. Gestantes e lactantes

| # | Fórmula | Referência | Decisão |
|---|---|---|---|
| 7.1 | Min. Saúde — Gestante (2005) | Ministério da Saúde, 2005 | [ ] |
| 7.2 | EER (2023) — Gestante | National Academies, 2023 | [ ] |
| 7.3 | EER (2023) — Lactante | National Academies, 2023 | [ ] |

⚠️ **Decisão sua:** estas entram **agora** na Fase 16 ou ficam para a fase própria de gestantes,
junto com o acompanhamento gestacional? Sem elas, a gestante ainda pode ser atendida com o
adicional manual (6.3).

---

## 8. Fica de fora (sugestão)

| Item | Por quê | Decisão |
|---|---|---|
| Integração HandyMET | Produto/serviço de outra empresa | [ ] sai |
| "Importar de acompanhamento gestacional" | Depende da fase de gestantes | [ ] depois |

---

## Fontes conferidas (01/10/2026, antes de programar)

Cada coeficiente foi tirado da publicação original ou de documento oficial, e conferido com uma
segunda fonte sempre que possível.

| Fórmula | Onde foi conferida |
|---|---|
| EER 2023 (adultos, 0–18 anos, custo de crescimento) | National Academies, *DRIs for Energy* (2023), Resumo, Tabelas S-1 e S-2 (texto oficial) + folheto oficial de jan/2023 (exemplo de mulher pouco ativa e de menino de 2 anos) |
| EER/IOM 2005 adultos | Tabela oficial do Food and Nutrition Board (IOM). Os coeficientes de atividade de homem (1,11 · 1,25 · 1,48) e de mulher (1,12 · 1,27 · 1,45) foram **recalculados a partir dos valores da própria tabela** e conferem |
| EER/IOM 2005 crianças (0–35 meses, 3–8, 9–18) | Duas reproduções independentes, iguais entre si; coeficientes de atividade infantis 1,13 · 1,26 · 1,42 (meninos) e 1,16 · 1,31 · 1,56 (meninas) |
| Harris-Benedict 1984 | Roza & Shizgal (1984), conferida na Universidade de Maastricht e em artigo do PMC |
| FAO/OMS 2004 (todas as idades) | Documento oficial da FAO, *Human energy requirements*, Tabela 5.2 (são as equações de Schofield **só com peso**) |
| Schofield 1985 infantil | Versão **com peso e altura** (a só com peso já é a FAO/OMS). ESPGHAN/ESPEN 2005 + revisão sistemática do PMC. ⚠️ As duas fontes **trocam meninos e meninas** na versão só com peso (10–18 anos); a versão com peso e altura foi testada contra a FAO e está com os sexos certos |
| Henry/Oxford 2005 | Relatório oficial do governo britânico (SACN, 2011), Tabelas 18 e 19. Usada a versão **com peso e altura** (a recomendada pelo SACN) |
| Henry & Rees 1991 | Tabela completa em material da UNESP; 5 das 8 equações conferidas em artigos independentes. **Não tem faixa para menores de 3 anos nem para 60 anos ou mais** |
| Mifflin-St Jeor por MLG | Resumo original (Mifflin et al., 1990): 19,7 × MLG + 413 |
| Cunningham 1980 | Resumo original: 500 + 22 × MLG |
| Tinsley 2018 | Manuscrito dos autores (Univ. de Toronto): 24,8 × peso + 10 e 25,9 × MLG + 284 |
| Katch-McArdle | 370 + 21,6 × MLG (livro-texto; igual em todas as fontes consultadas) |
| Lista de atividades MET | *Compendium of Physical Activities*: uso **comercial permitido**, desde que cite a fonte e não altere os valores de MET |

## Para revisar quando a tela estiver pronta

| Item | O que foi feito | Por quê |
|---|---|---|
| Fatores injúria (seção 5) | Valores copiados do WebDiet | O artigo de Long (1979) não é de acesso livre; não foi possível conferir na fonte |
| Idade nas fórmulas EER infantis | Bebês (EER 2023, 0–2 anos): idade em anos com fração (ex.: 18 meses = 1,5). Demais: anos completos | As tabelas dizem só "idade em anos" |
| Henry/Oxford | Versão com peso e altura | Recomendada pelo SACN; o WebDiet não tem Henry/Oxford para comparar |
