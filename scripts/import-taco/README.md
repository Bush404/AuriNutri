# Importação da Tabela Brasileira de Composição de Alimentos (TACO)

Este script importa alimentos da TACO (NEPA/UNICAMP) como **alimentos globais**
(`is_global = true`, `user_id = null`), visíveis a todos os nutricionistas mas
não editáveis nem excluíveis por eles.

## ✅ Já vem com um conjunto inicial real de 43 alimentos

O arquivo `data/taco-4a-edicao.csv` já está preenchido com **dados reais**,
transcritos e conferidos manualmente a partir do PDF oficial da 4ª edição
ampliada e revisada da TACO (NEPA/UNICAMP, 2011), célula por célula. Nenhum
valor foi estimado ou inventado.

Cobre alimentos comuns do dia a dia de um consultório: arroz, macarrão, pão,
batata, cebola, cenoura, tomate, frutas (abacate, banana, laranja, morango,
uva, abacaxi), peixes (atum, salmão, sardinha), carnes bovina/frango/suína
em vários preparos, leite e queijos, ovos, mel e feijão.

**Limitação importante e deliberada:** para esse conjunto inicial, apenas os
macronutrientes centrais foram importados com segurança (energia, proteína,
carboidrato, gordura, fibra, umidade, cinzas, colesterol, cálcio, magnésio).
Os demais micronutrientes (ferro, sódio, potássio, vitaminas, etc.) foram
deixados em branco para esses itens — não porque não existam na TACO, mas
porque a extração automática de texto do PDF embaralha o alinhamento de
colunas nas seções de vitaminas/minerais quando uma célula está vazia,
e preferimos não arriscar atribuir um número à coluna errada. Rodar o
import novamente com o arquivo completo (abaixo) preenche esses campos
corretamente. A única exceção é o item "Feijão, carioca, cozido", com todos
os micronutrientes, obtido de uma fonte já estruturada (JSON) sem essa
ambiguidade.

Para já ver funcionando, basta rodar:

```bash
npm run import:taco
```

(depois de configurar a `SUPABASE_SERVICE_ROLE_KEY`, ver seção 3 abaixo).

## Como expandir para as ~597 entradas completas da TACO

Para importar a tabela completa, com todos os ~30 nutrientes por alimento,
recomendamos o pipeline open-source [brolesi/taco](https://github.com/brolesi/taco)
(MIT, dados normalizados a partir da planilha oficial, com o mesmo tratamento
de traço/não analisado que usamos aqui):

1. Baixe ou clone o repositório: `git clone https://github.com/brolesi/taco.git`
2. Copie o arquivo `data/processed/taco/taco_composicao.csv` desse repositório
3. Substitua o arquivo `scripts/import-taco/data/taco-4a-edicao.csv` da
   AuriNutri por ele (os nomes de coluna já são compatíveis com este script:
   `numero_alimento`, `descricao`, `categoria`, `umidade_pct`, `energia_kcal`,
   `proteina_g`, `lipideos_g`, `colesterol_mg`, `carboidrato_g`, `fibra_g`,
   `cinzas_g`, `calcio_mg`, `magnesio_mg`, `manganes_mg`, `fosforo_mg`,
   `ferro_mg`, `sodio_mg`, `potassio_mg`, `cobre_mg`, `zinco_mg`,
   `retinol_mcg`, `RE_mcg`, `RAE_mcg`, `tiamina_mg`, `riboflavina_mg`,
   `piridoxina_mg`, `niacina_mg`, `vitamina_c_mg`)
4. Rode `npm run import:taco` de novo — o upsert por `codigo_taco` atualiza
   os 43 itens já importados (preenchendo os micronutrientes que faltavam)
   e adiciona os demais, sem duplicar nada.

## Formato do CSV (referência completa)

- Todos os valores nutricionais são **por 100 g** (padrão da própria TACO).
  O script grava `porcao_referencia_g = 100` para todo item.
- `numero_alimento` é o número do alimento na tabela oficial — é a chave
  usada para identificar duplicatas e permitir reimportação sem duplicar.
- Separador decimal aceito: `.` ou `,`. Separador de campo do CSV: `,`
  (por isso os nomes dos alimentos com vírgula vêm entre aspas).
- Valores especiais da fonte original:
  - `Tr` ou `tr` → traço (quantidade não quantificável, mas presente)
  - `NA` → não analisado
  - célula vazia → não informado

  **Nenhum desses três casos é convertido para `0`.** O valor da coluna fica
  `NULL` no banco e o motivo exato é preservado em `valores_especiais` (ex:
  `{"fibras_g": "traco"}`), para nunca mascarar "sem dado" como "zero".

## Configurar a chave de serviço (obrigatória para importar)

O script precisa da **Service Role Key** do Supabase (não a chave anônima),
pois ela ignora RLS e é a única forma de inserir alimentos globais (que não
pertencem a nenhum usuário). Essa chave é secreta e **nunca** deve ser usada
no navegador nem commitada.

No seu `.env.local`, adicione:

```
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

(Encontrada em Project Settings > API > service_role, no painel do Supabase.)

## Rodar a importação

```bash
npm run import:taco
```

O script lê e valida o CSV, normaliza os valores especiais, faz **upsert**
por `codigo_taco` (rodar de novo atualiza em vez de duplicar) e imprime um
resumo: quantos alimentos foram importados e quaisquer observações de
validação.

## O que o script nunca faz

- Não insere nenhum valor que não esteja explicitamente no arquivo.
- Não converte "traço" ou "não analisado" em `0`.
- Não sobrescreve alimentos personalizados dos nutricionistas (eles vivem na
  mesma tabela, mas são identificados por `user_id` + `is_global = false`, e
  o script só toca em linhas com `is_global = true`).
- Não apaga alimentos TACO que estejam faltando no novo arquivo (importação
  aditiva/atualizadora, não substitutiva).
