# Testes E2E (Playwright)

Um navegador automático percorre os fluxos críticos do AuriNutri como uma nutricionista faria:

- `auth.e2e.ts` — rota protegida redireciona para o login; senha errada é recusada; login correto
  leva ao destino pedido.
- `plano-alimentar.e2e.ts` — cadastrar paciente → criar plano → adicionar refeição → buscar um
  alimento TACO e adicioná-lo.

## Como rodar

1. Coloque temporariamente `SUPABASE_SERVICE_ROLE_KEY=...` no `.env.local` (mesmo fluxo de
   `npm run import:taco` e `npm run test:security-isolation-full`).
2. `npm run test:e2e` (sobe o `next dev` na porta 3100 sozinho, se ele não estiver rodando).
3. Remova a service role key do `.env.local` depois.

Uma conta descartável (`teste-e2e-...@aurinutri.invalid`, e-mail já confirmado) é criada no
início e apagada no fim, com todos os dados que o teste gerou. Se um teste falhar, o relatório
com print e trace fica em `playwright-report/` (`npx playwright show-report`).

Primeira vez numa máquina nova: `npx playwright install chromium`.
