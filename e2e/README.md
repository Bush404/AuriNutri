# Testes E2E (Playwright)

Um navegador automático percorre os fluxos críticos do AuriNutri como uma nutricionista faria —
os caminhos que, se quebrarem, o produto para:

| Arquivo | Fluxo |
| --- | --- |
| `cadastro.e2e.ts` | criar conta → (confirmação de e-mail via admin) → login → dashboard |
| `auth.e2e.ts` | rota protegida redireciona para o login; senha errada é recusada; login leva ao destino |
| `avaliacao.e2e.ts` | criar paciente → avaliação antropométrica → IMC calculado (22,86 para 70 kg / 175 cm) |
| `plano-alimentar.e2e.ts` | paciente → plano → refeição → alimento TACO; alimento próprio → plano → macros conferidos → PDF gerado |
| `receita.e2e.ts` | receita pelas 4 etapas do assistente → usada num plano |
| `agenda.e2e.ts` | agendar consulta com cobrança "Não pago" → marcar como realizada → cobrança em aberto no financeiro |
| `central-envio.e2e.ts` | material da biblioteca + plano pela Central de Envio → os dois links abrem o PDF sem login |
| `arquivos.e2e.ts` | consentimento → foto de evolução e exame em PDF enviados ao Storage (foto exibida via URL assinada) |
| `senha.e2e.ts` | "esqueci a senha": link do e-mail (token_hash) aberto antes pelo "filtro" → Continuar → nova senha → login com ela; link não vale duas vezes |

## Como rodar

1. Coloque temporariamente `SUPABASE_SERVICE_ROLE_KEY=...` no `.env.local` (mesmo fluxo de
   `npm run import:taco` e `npm run test:security-isolation-full`).
2. `npm run test:e2e` (sobe o `next dev` na porta 3100 sozinho, se ele não estiver rodando) — ou
   `npm run test:e2e:prod` para rodar os mesmos testes contra o site publicado
   (`https://app.aurinutri.com`), sem subir servidor local.
3. Remova a service role key do `.env.local` depois.

Uma conta descartável (`teste-e2e-...@aurinutri.invalid`, e-mail já confirmado) é criada no
início e apagada no fim, com todos os dados que o teste gerou (o teste de cadastro cria e apaga a
sua própria). Se um teste falhar, o relatório com print e trace fica em `playwright-report/`
(`npx playwright show-report`).

Primeira vez numa máquina nova: `npx playwright install chromium`.
