# Importação da USDA (Fase 18)

Complementa a TACO com alimentos da **USDA FoodData Central — SR Legacy (abril/2018)**,
domínio público (uso comercial livre, com citação da fonte).

## Passo a passo

1. Baixe e descompacte em `scripts/import-usda/fonte/` (fica fora do git):
   https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
2. `node scripts/import-usda/gerar-candidatos.mjs` — filtra o que faz sentido no Brasil e
   grava `candidatos.json` (fora do git) com nutrientes nas colunas da TACO e medidas caseiras.
3. `node scripts/import-usda/gerar-planilha.mjs` — monta `revisao-usda.xlsx` para a
   nutricionista revisar (Incluir S/N, nome em português, categoria).
4. Importação: lê a planilha revisada (a escrever, depois da revisão).

## Padronização (jeito brasileiro / modelo TACO)

`padronizar.mjs` monta o nome final no modelo da TACO, não só traduzido: carnes como
"Carne, bovina, contra-filé, sem gordura, grelhado" (corte brasileiro; sem equivalente → nome
americano), aves "Frango, peito, sem pele, grelhado", "Leite, de vaca, integral", "Ovo, de
galinha, inteiro, cozido", preparo em cru/cozido/assado/grelhado/frito. Variações americanas que
viram o mesmo nome (graus da carne, aparagem, importada, com/sem sal no cozimento, A e D,
enriquecido/branqueado, rotulagem do presunto) são juntadas: fica a versão de menor `prioridade()`.

## Tradução dos nomes

`traducao/*.json` é um dicionário de partes do nome (os nomes da USDA são partes separadas
por vírgula, no mesmo padrão da TACO). Regras em `montar-nome.mjs`: `"a|b"` = adjetivo
masculino|feminino (concorda com o 1º termo), `"x#f"` = substantivo e gênero, `""` = some do
nome, chave com vírgula = expressão de vários termos. Corrigir um termo aqui muda todos os
alimentos que o usam.

## O que fica de fora

Restaurantes e fast-food americanos, alimentos indígenas do Alasca, papinhas, pratos prontos,
produtos de marca (lista em `gerar-candidatos.mjs`), caça e as classificações comerciais da carne
bovina americana (choice/select/prime — fica só "all grades"). Nutriente ausente na USDA vira
`nao_informado` em `valores_especiais`, nunca zero.

Citação: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019.
fdc.nal.usda.gov.
