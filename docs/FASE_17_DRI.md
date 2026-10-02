# Fase 17, Bloco F — Micronutrientes × DRI

## Fonte

National Academies of Sciences, Engineering, and Medicine. *Dietary Reference Intakes for Sodium and
Potassium* (2019), **Appendix J — Dietary Reference Intakes Summary Tables**. doi:10.17226/25353.
Texto lido em `nap.nationalacademies.org/read/25353/chapter/28` em 02/10/2026. As mesmas tabelas estão no
NCBI Bookshelf (NBK545442), que bloqueia acesso automático.

As tabelas usadas foram:

- RDA e AI de vitaminas
- RDA e AI de elementos
- RDA e AI de água total e macronutrientes (fibra)
- UL de vitaminas e de elementos
- CDRR do sódio

## Como os números entraram (sem digitação)

`scripts/dri/extrair.cjs` lê o texto da publicação e separa as 22 faixas de vida de cada coluna. Ele confere
o número de valores de cada tabela e para se não bater. `scripts/dri/gerar-ts.cjs` gera
`src/lib/dri-tabela.ts` a partir disso.

Uma amostra foi conferida à mão contra a tabela e está em `src/lib/dri.test.ts`: adultos, idosos, crianças,
gestante e lactante, além das conversões de unidade.

## Nutrientes comparados

Os nutrientes que a TACO traz e que têm DRI:

| Coluna (TACO) | Recomendação | Limite |
|---|---|---|
| fibras_g | AI | — |
| calcio_mg | RDA | UL |
| ferro_mg | RDA | UL |
| magnesio_mg | RDA | — (UL só vale para suplemento/medicamento) |
| fosforo_mg | RDA | UL (g/d → mg) |
| zinco_mg | RDA | UL |
| cobre_mg | RDA (µg/d → mg) | UL (µg/d → mg) |
| manganes_mg | AI | UL |
| potassio_mg | AI | — (sem UL) |
| sodio_mg | AI | **CDRR** ("reduzir se acima de": 1.200 / 1.500 / 1.800 / 2.300 mg) |
| rae_mcg | RDA (vitamina A em RAE) | — |
| retinol_mcg | — | UL (o UL da vitamina A é só de retinol pré-formado) |
| vitamina_c_mg | RDA | UL |
| tiamina_mg, riboflavina_mg | RDA | — (sem UL) |
| niacina_mg | RDA (em NE) | — (UL só para forma sintética) |
| piridoxina_mg | RDA | UL |

Estes não têm DRI e só aparecem com o total: colesterol, gordura saturada, gordura monoinsaturada e gordura
poli-insaturada.

## Regras

- **Faixa de vida:** vem do sexo e da idade do paciente na data de hoje. Para gestante e lactante, a escolha
  é feita na tela ou nas opções do PDF, porque não fica guardada no cadastro. Menores de 1 ano e sexo
  "outro" sem idade de criança ficam sem faixa, e a tela pede o cadastro.
- **Adequação** (lista R7): abaixo de 80% da RDA/AI é "Abaixo"; de 80% a 120% é "Adequado"; acima de 120% é
  "Acima". Acima do UL (ou da CDRR, no sódio) aparece "Acima do limite", que vale mais que as outras.
- **Sem dado não vira zero:**
  - Alimento sem o valor na TACO deixa o total marcado como parcial (*).
  - Se nenhum alimento tem o valor, o total fica "—".
  - Traço conta como 0 conhecido.
- **Niacina:** a DRI é em equivalentes de niacina (NE). A TACO traz niacina pré-formada, então o percentual
  pode subestimar a ingestão.

## Dados do plano (migration 0046)

`meal_items` e `meal_item_substitutions` passam a guardar a cópia dos micronutrientes, como já faziam com os
macros, junto com `valores_especiais` e `micros_copiados`.

Itens antigos vindos da TACO recebem os valores da TACO na migration. É uma exceção consciente à regra de
nunca reler o alimento: a TACO é referência imutável no app. Itens antigos de alimentos próprios e de
receitas ficam "sem dado", e a tela diz quantos são.

Em receitas, o valor por porção é a soma do que os ingredientes têm. Fica nulo só se nenhum ingrediente tem
o dado.
