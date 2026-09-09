# AuriNutri

Plataforma moderna e acessível para nutricionistas — gestão de pacientes, anamnese, avaliação
antropométrica, banco de alimentos (base TACO + personalizados) e planos alimentares com
cálculo automático de macros.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth + PostgreSQL + RLS)

## 1. Pré-requisitos

- Node.js 18.18+ (recomendado 20 LTS)
- Uma conta e um projeto criado em [supabase.com](https://supabase.com)

## 2. Instalar dependências

```bash
npm install
```

## 3. Configurar o Supabase

1. No painel do seu projeto Supabase, vá em **SQL Editor** e execute, **nesta ordem**:
   - `supabase/migrations/0001_init.sql` — schema inicial (pacientes, anamnese, avaliações, alimentos, planos).
   - `supabase/migrations/0002_taco_foods.sql` — adiciona suporte à base TACO (alimentos globais),
     micronutrientes e o snapshot histórico dos itens de plano alimentar.
2. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.
3. Duplique o arquivo `.env.local.example` como `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. (Opcional, mas recomendado em desenvolvimento) Em **Authentication > URL Configuration**,
   adicione `http://localhost:3000/auth/callback` na lista de *Redirect URLs*.
5. Em **Authentication > Providers > Email**, você pode desativar "Confirm email" durante o
   desenvolvimento para testar o cadastro sem precisar clicar no link de confirmação.

## 3.1 (Opcional) Importar a base TACO

A AuriNutri já vem com um conjunto inicial de **43 alimentos reais da TACO**
(NEPA/UNICAMP), conferidos manualmente contra o PDF oficial da 4ª edição —
o suficiente para você já ver o recurso funcionando de ponta a ponta. Para
carregá-los, configure a `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` e rode:

```bash
npm run import:taco
```

Veja `scripts/import-taco/README.md` para os detalhes (o que exatamente foi
importado, a limitação conhecida sobre micronutrientes nesse conjunto
inicial, e como expandir para as ~597 entradas completas da TACO depois).

## 4. Rodar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Você será redirecionado para `/login`.
Crie uma conta em `/cadastro` para começar.

## 5. Deploy no Netlify

O projeto já está configurado para deploy no Netlify via `netlify.toml`, que usa
o [runtime oficial do Next.js para Netlify](https://docs.netlify.com/frameworks/next-js/overview/)
(`@netlify/plugin-nextjs`). Ele converte automaticamente Server Components,
Server Actions, Route Handlers e o `middleware.ts` em Netlify Functions/Edge
Functions — não é necessário nenhum ajuste de código além do que já está aqui.

### Passo a passo

1. **Suba o projeto para um repositório Git** (GitHub, GitLab ou Bitbucket) —
   o Netlify faz deploy a partir de um repositório, não de um zip.
2. No painel do Netlify, clique em **"Add new site" > "Import an existing project"**
   e conecte o repositório. O Netlify detecta automaticamente o `netlify.toml`
   (build command `npm run build`, plugin do Next.js já configurado).
3. Em **Site configuration > Environment variables**, adicione:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
   NEXT_PUBLIC_SITE_URL=https://SEU-SITE.netlify.app
   ```

   (Ajuste `NEXT_PUBLIC_SITE_URL` para o domínio real depois do primeiro
   deploy, ou já use um domínio customizado se tiver um definido de antemão.)

   Não é necessário configurar `SUPABASE_SERVICE_ROLE_KEY` no Netlify — essa
   chave só é usada pelo script local `npm run import:taco`, que roda na sua
   máquina, nunca no site publicado.

4. No painel do **Supabase**, em **Authentication > URL Configuration**,
   adicione as URLs do seu site Netlify:
   - **Site URL:** `https://SEU-SITE.netlify.app`
   - **Redirect URLs:** `https://SEU-SITE.netlify.app/auth/callback`

   Sem isso, os links de confirmação de cadastro e recuperação de senha por
   e-mail vão continuar apontando para `localhost`.

5. Clique em **Deploy site**. Builds seguintes acontecem automaticamente a
   cada push na branch configurada.

### Rodando a migration e a importação da TACO

Migrations SQL e o `npm run import:taco` continuam sendo executados **fora**
do Netlify (no SQL Editor do Supabase e na sua máquina local, respectivamente)
— o Netlify hospeda apenas a aplicação Next.js, não o banco de dados.

## Estrutura do projeto

```
src/
  app/
    (auth)/          # login, cadastro, recuperação de senha (layout com branding)
    (app)/            # área logada: dashboard, pacientes, alimentos, planos, fontes
    auth/callback/     # troca o código do link de e-mail por uma sessão
  components/
    ui/               # componentes base (shadcn/ui)
    layout/           # sidebar, topbar, navegação
    patients/         # formulário, tabela, abas do perfil, anamnese, avaliações
    foods/            # banco de alimentos: filtros, tabela, formulário, detalhe
    meal-plans/       # construtor de plano alimentar, combobox de alimentos, totais
    shared/            # logo, empty state
  lib/
    supabase/          # clients (browser, server, middleware)
    actions/           # Server Actions (pacientes, anamnese, avaliações, alimentos, planos)
    validations/       # schemas Zod
    types/             # tipos do banco de dados
    nutrition.ts        # cálculo de macros e atribuição de fonte (TACO/personalizado)
supabase/
  migrations/
    0001_init.sql              # schema inicial + RLS
    0002_taco_foods.sql         # alimentos globais (TACO), micronutrientes, snapshot histórico
scripts/
  import-taco/          # script de importação da TACO (ver README próprio)
```

## Segurança / multiusuário

Todas as tabelas têm Row Level Security habilitado. Cada nutricionista só enxerga (e só pode
alterar) os próprios pacientes, avaliações, alimentos personalizados e planos alimentares, via
políticas baseadas em `auth.uid() = user_id`. Alimentos da base TACO são visíveis a todos os
nutricionistas, mas só podem ser inseridos/alterados pelo processo de importação (Service Role,
que ignora RLS) — nenhum nutricionista pode editar ou excluir um alimento da TACO, nem pela
interface nem diretamente no banco.

## O que já funciona

- Cadastro, login e recuperação de senha (Supabase Auth)
- Proteção de rotas via middleware + verificação em Server Components
- Dashboard com métricas reais
- CRUD completo de pacientes (criar, editar, excluir, buscar)
- Perfil do paciente com abas: informações gerais, anamnese, avaliações antropométricas
  (com IMC calculado automaticamente no banco), gráfico de evolução e planos alimentares
- "Meus Alimentos": CRUD completo de alimentos personalizados por nutricionista (busca,
  categoria, ordenação) — a base TACO não aparece aqui, apenas no construtor de plano
- Base TACO: alimentos globais, somente leitura, com atribuição de fonte visível, disponíveis
  na busca do construtor de plano alimentar (agrupados como "Meus alimentos" / "Base TACO")
- Construtor de plano alimentar com busca de alimentos (Meus alimentos / Base TACO), cálculo
  automático de macros por item/refeição/dia, e **snapshot nutricional histórico**: editar ou
  excluir um alimento depois nunca altera planos já montados
- Página "Fontes de Dados" com a atribuição correta à TACO/NEPA/UNICAMP

## Próximos passos sugeridos

- Exportar planos alimentares em PDF (a arquitetura de atribuição de fonte já está pronta em
  `lib/nutrition.ts` — `buildFonteFooter`)
- Edição do perfil do próprio nutricionista (nome, CRN)
- Duplicar um plano alimentar existente
