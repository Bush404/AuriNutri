# Medidas caseiras do IBGE (Fase 17, Bloco D)

`npm run import:medidas` grava em `food_measures` as medidas caseiras ("unidade média = 50 g",
"colher de sopa cheia = 25 g") dos alimentos da TACO. Precisa da migration `0045_medidas_caseiras.sql`
aplicada, da TACO importada e da `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`. Pode rodar de novo: troca
só as medidas do IBGE; as criadas pelos profissionais e os planos já montados não mudam.

## De onde vêm os dados

IBGE, Pesquisa de Orçamentos Familiares 2008–2009 — *Tabela de medidas referidas para os alimentos
consumidos no Brasil* (`tabelamedidas_bd.xls`) e, só para o casamento de nomes, a tabela de composição
(`tabelacompleta.xls`), em
`ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/`.
A tabela de composição do IBGE **não** é importada (é uma compilação com muitos valores de outras
tabelas); usamos só as medidas, e os valores nutricionais continuam sendo os da TACO.

As medidas do IBGE são por (código do alimento, código da preparação). O nome real da medida está na
coluna "descrição do alimento na referência" (ex.: "Arroz cozido - colher de arroz cheia").

## Como `medidas-ibge-taco.json` foi feito

Os scripts em `gerar/` rodam fora do projeto (precisam do pacote `xlsx` e dos dois arquivos do IBGE):

1. `casar.cjs <taco.csv>` — para cada alimento da TACO, sugere os 3 alimentos+preparo do IBGE mais
   parecidos.
2. `decidir.cjs` — aceita só ligações seguras: mesmo nome-base, sem mudar o produto (ex.: "extrato de
   tomate" não liga em "tomate"), e só medidas do mesmo estado (alimento cru não recebe medida de cozido).
3. `final.cjs <saída.json>` — aplica a revisão manual (ligações rejeitadas ou trocadas, uma a uma),
   limpa os nomes das medidas e grava o arquivo.

Resultado em 02/10/2026: 315 dos 597 alimentos da TACO com medidas (1.922 medidas). Os demais ficam só
em gramas, e o profissional pode criar as próprias medidas para qualquer alimento.
