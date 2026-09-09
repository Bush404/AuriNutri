# PROJECT_AUDIT — AuriNutri

**Data:** 09/09/2026
**Escopo:** auditoria do código existente, sem alteração de arquivos.
**Método:** inventário de rotas, Server Actions, migrations, políticas RLS e busca por padrões (estados de UI, testes, paginação, storage).

---

## 1. Resumo executivo

A AuriNutri hoje é um **MVP funcional e coeso de consultório básico**: autenticação, pacientes, anamnese, antropometria com evolução, banco de alimentos e construtor de plano alimentar com cálculo de macros. Está publicado no Netlify e conectado a um Supabase real.

A base é melhor do que o normal para um projeto neste estágio em três pontos específicos:

- **RLS real no banco**, não apenas checagem no frontend.
- **Snapshot nutricional em `meal_items`** — planos alimentares antigos não mudam quando um alimento é editado ou excluído. Esta é uma decisão que raramente se toma no início e é cara de retrofitar depois.
- **Valores ausentes preservados** (`traço` / `não analisado` ≠ zero) na integração TACO.

Em contrapartida, o projeto tem **zero testes**, **nenhum estado de loading/erro em nível de rota**, **nenhuma paginação** e **nenhuma infraestrutura de arquivos** — e a visão de produto descrita (exames, evolução fotográfica, documentos, área do paciente, comunidade) depende inteiramente de storage, que não existe ainda.

O risco dominante não é a qualidade do que existe. É a **distância entre o que existe (~15% da visão) e o que foi planejado**, combinada com a ausência de rede de segurança (testes) para expandir com confiança.

**Recomendação central:** não avançar para novos módulos antes de fechar as lacunas de fundação (Fase 1). São ~1 semana de trabalho que evitam retrabalho em todas as fases seguintes.

---

## 2. Stack atual

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.13 |
| Linguagem | TypeScript | 5.x (strict: true) |
| UI | React | 18.3 |
| Estilo | Tailwind CSS | 3.4 |
| Componentes | shadcn/ui (Radix) | manual, não via CLI |
| Formulários | react-hook-form + Zod | 7.53 / 3.23 |
| Backend | Supabase (Postgres + Auth + RLS) | @supabase/ssr 0.5 |
| Notificações | sonner | 1.5 |
| Ícones | lucide-react | 0.446 |
| Deploy | Netlify (@netlify/plugin-nextjs 5.7) | — |

**Ausentes:** framework de testes, biblioteca de gráficos (o gráfico de evolução é SVG manual), geração de PDF, cliente de e-mail transacional, observabilidade/error tracking.

---

## 3. Arquitetura atual

```
Navegador
   │
   ├─ middleware.ts ──── Edge: renova sessão Supabase + protege rotas
   │
   ├─ Server Components ─── leitura de dados (createClient de server.ts)
   │        │
   │        └─ Supabase Postgres ── RLS: auth.uid() = user_id
   │
   └─ Client Components ─── formulários
            │
            └─ Server Actions ── escrita + revalidatePath
                     │
                     └─ Supabase Postgres ── RLS
```

**Padrões corretos observados:**

- Leitura em Server Components, escrita em Server Actions. Sem rotas de API redundantes.
- RLS implícito: as actions não fazem `.eq("user_id", user.id)` manualmente na maioria dos casos, delegando o isolamento ao banco. Menos código e menos chance de esquecer uma checagem.
- Dupla proteção de rota: `middleware.ts` + verificação no `(app)/layout.tsx`.
- `revalidatePath` após cada mutação.

**Camadas:**

| Pasta | Responsabilidade |
|---|---|
| `src/app/(auth)` | login, cadastro, recuperação (layout com branding) |
| `src/app/(app)` | área logada, protegida |
| `src/lib/actions` | 20 Server Actions, agrupadas por domínio |
| `src/lib/validations` | schemas Zod por domínio |
| `src/lib/types` | tipos do banco escritos à mão |
| `src/lib/nutrition.ts` | cálculo de macros + atribuição de fonte |
| `src/components/{ui,layout,patients,foods,meal-plans,shared}` | componentes por domínio |

---

## 4. Estrutura do projeto

**78 arquivos em `src`** (59 `.tsx`, 18 `.ts`, 1 `.css`).

**18 rotas:**

```
/                          → redireciona (dashboard ou login)
/login  /cadastro  /esqueci-senha  /redefinir-senha
/auth/callback             → route handler (troca code por sessão)
/dashboard
/pacientes  /pacientes/novo  /pacientes/[id]  /pacientes/[id]/editar
/alimentos
/planos  /planos/[id]
/fontes
```

**Banco — 8 tabelas:** `profiles`, `patients`, `anamnesis`, `anthropometric_assessments`, `foods`, `meal_plans`, `meals`, `meal_items`.

**2 migrations:** `0001_init.sql` (schema + RLS), `0002_taco_foods.sql` (alimentos globais, micronutrientes, snapshot).

---

## 5. Funcionalidades existentes

| Funcionalidade | Estado | Observação |
|---|---|---|
| Cadastro / login / logout | ✅ | com try/catch e feedback |
| Recuperação de senha | ⚠️ | código pronto, mas e-mail do Supabase é só para teste |
| Proteção de rotas | ✅ | middleware + layout |
| Dashboard com métricas reais | ✅ | 3 contadores + 5 pacientes recentes |
| Pacientes: CRUD + busca | ✅ | busca server-side por nome |
| Perfil do paciente (abas) | ✅ | info, anamnese, avaliações, evolução, planos |
| Anamnese | ✅ | upsert, 11 campos |
| Avaliação antropométrica | ⚠️ | criar e excluir apenas — **sem edição** |
| IMC automático | ✅ | coluna gerada no Postgres |
| Gráfico de evolução | ✅ | SVG manual, peso + IMC |
| Meus Alimentos (CRUD) | ✅ | busca, categoria, ordenação |
| Base TACO | ⚠️ | infraestrutura completa; **43 de 597 alimentos** |
| Plano alimentar | ✅ | refeições, itens, macros por item/refeição/dia |
| Snapshot nutricional | ✅ | decisão arquitetural forte |
| Atribuição de fonte (TACO) | ✅ | rodapé condicional + página /fontes |

---

## 6. Funcionalidades incompletas

1. **Editar perfil do nutricionista** — item de menu existe e está `disabled`. O campo `crn` está no tipo e no banco, mas **não é usado em lugar nenhum da UI**. Bloqueia toda a Fase de Documentos (documentos precisam de nome, CRN, logo, assinatura).
2. **Editar avaliação antropométrica** — só criar e excluir. Erro de digitação em uma medida obriga apagar e refazer.
3. **Base TACO** — 43 alimentos, e desses, apenas 1 com micronutrientes completos. Os outros 42 têm só macros + alguns minerais, por limitação da extração de PDF (documentada em `scripts/import-taco/README.md`).
4. **Recuperação de senha** — funciona tecnicamente, mas depende do SMTP de teste do Supabase (~3 e-mails/hora, entrega ruim, bloqueado por Hotmail/Outlook).

---

## 7. Problemas encontrados

### 7.1 Críticos

**Nenhum teste.** Zero arquivos `.test.*`/`.spec.*`, nenhum runner configurado. Com cálculo nutricional (dado clínico) e RLS multiusuário, isso é o risco mais alto do projeto. Um erro no fator de proporção de macros é silencioso e vai direto para o plano de um paciente real.

**Nenhum `error.tsx`, `loading.tsx` ou `not-found.tsx`.** Qualquer exceção em Server Component vira a tela branca genérica do Next ("a server-side exception has occurred"). Já aconteceu em produção neste projeto.

**Segredos reais em `.env.production` no diretório do projeto.** Está no `.gitignore`, mas existe em disco e já circulou em zips. A chave é a `anon` (pública por natureza, protegida por RLS) — não é vazamento, mas o arquivo precisa deixar de existir assim que o deploy passar a ser via Git.

### 7.2 Altos

**Sem paginação em nenhuma listagem.** `/pacientes`, `/alimentos` e `/planos` fazem `select("*")` sem `range()`. Com a TACO completa (597 itens) ou 200 pacientes, a página carrega tudo. Degrada de forma invisível até virar problema.

**Tipagem do banco enfraquecida.** O generic `<Database>` foi removido dos clients Supabase porque o schema escrito à mão fazia o parser de `select()` inferir `never`. Compensado com `.returns<T>()`/`.single<T>()` em todas as queries, mas o tipo agora é uma **afirmação manual**, não verificada contra o schema real. Se uma coluna mudar no banco, o TypeScript não avisa.

**Sem storage.** Nenhum uso de Supabase Storage. Exames, evolução fotográfica, documentos, logo e assinatura — todos bloqueados.

**Senha mínima de 6 caracteres.** Fraco para dados de saúde.

### 7.3 Médios

- Tipos do banco mantidos à mão em vez de gerados via `supabase gen types`.
- Sem `debounce` real na busca de pacientes (dispara a cada tecla; o combobox de alimentos tem debounce de 250ms, a busca de pacientes não).
- Sem tratamento de conflito de escrita concorrente (last-write-wins em toda parte).
- `deleteFood` não é bloqueado quando o alimento está em uso — correto pelo design de snapshot, mas a mensagem ao usuário poderia explicar melhor.

---

## 8. Dívida técnica

| Item | Impacto | Esforço | Prioridade |
|---|---|---|---|
| Ausência de testes | Alto | Médio | CRITICAL |
| `error.tsx` / `loading.tsx` por rota | Alto | Baixo | CRITICAL |
| Tipos gerados do Supabase | Médio | Baixo | HIGH |
| Paginação nas listagens | Médio | Médio | HIGH |
| Editar perfil + CRN | Alto (bloqueia docs) | Baixo | HIGH |
| Editar avaliação | Baixo | Baixo | MEDIUM |
| TACO completa | Médio | Baixo | MEDIUM |
| SMTP próprio | Alto (bloqueia onboarding real) | Baixo | HIGH |

---

## 9. Problemas de UX/UI

**Bons:** empty states em todas as listagens; feedback via toast em todas as ações; badges de origem (TACO/Personalizado); quantidade editável inline no plano; sugestões rápidas de refeição; layout de auth com branding.

**A corrigir:**

1. **Sem skeleton/loading entre navegações.** Server Components sem `loading.tsx` deixam a tela congelada durante a busca de dados. Percebido como lentidão.
2. **Erro vira tela branca.** Sem `error.tsx`, o usuário não tem como se recuperar.
3. **Sem confirmação ao sair de formulário com alterações não salvas** (anamnese tem 11 campos de texto longo — perder isso é doloroso).
4. **Fluxo de criação de plano tem muitos passos:** criar plano → criar refeição → buscar alimento → digitar quantidade → adicionar. Um plano de 5 refeições com 4 alimentos cada = ~40 interações. É o fluxo mais usado do produto e o mais caro hoje. Candidato a templates de refeição e duplicação de plano.
5. **Acessibilidade não verificada:** sem auditoria de contraste, navegação por teclado ou leitor de tela. O gráfico SVG de evolução não tem alternativa textual.
6. **Mobile do profissional não testado** — a tabela de plano alimentar tem 7 colunas e esconde 4 no mobile.

---

## 10. Problemas de segurança

**Bem resolvido:**

- RLS habilitado nas 8 tabelas, com políticas por operação (select/insert/update/delete).
- Alimentos TACO globais: legíveis por todos, graváveis apenas por service role.
- `foods.is_global` protegido por CHECK constraint (`is_global = true` ⟺ `user_id is null`).
- Verificação de propriedade em `updateFood`/`deleteFood` antes de mutar.
- `service_role` nunca exposta ao cliente.

**Lacunas:**

| Item | Risco | Nota |
|---|---|---|
| Sem trilha de auditoria | Alto | Dado clínico alterado sem registro de quem/quando. Relevante para LGPD. |
| Sem soft delete | Alto | `deletePatient` apaga em cascata anamnese, avaliações e planos. Irreversível. |
| Sem política de retenção/exportação | Alto | LGPD: titular tem direito a acesso e portabilidade dos dados. |
| Sem rate limiting nas actions | Médio | Server Actions são endpoints públicos autenticados. |
| Senha de 6 caracteres | Médio | Fraco para dados de saúde. |
| Sem consentimento registrado do paciente | Alto | O paciente não é usuário do sistema, mas seus dados de saúde estão nele. |
| `profiles` sem policy de INSERT | Baixo | Criado por trigger `security definer` — funciona, mas é implícito. |

**Observação importante:** o modelo atual assume **um nutricionista = uma conta**. Não há conceito de clínica, equipe ou papéis. A visão do produto (consultórios) vai exigir isso, e retrofitar multi-tenancy sobre RLS baseado em `user_id` é uma migração delicada. **Decidir isso antes da Fase de Agenda.**

---

## 11. Problemas de performance

1. **Sem paginação** (ver 7.2) — o mais relevante.
2. **Índices existem** para FKs e busca (`gin` com `to_tsvector('portuguese')` em `patients.nome` e `foods.nome`), mas a busca usa `ilike '%termo%'`, que **não usa o índice GIN**. O índice está lá e é inútil no formato atual. Migrar a busca para full-text ou trocar por índice `gin_trgm_ops`.
3. **Dashboard faz 4 queries em paralelo** — correto (`Promise.all`).
4. **Sem cache** — todas as páginas são dinâmicas por usarem cookies. Correto para dados por usuário, mas a base TACO (global e imutável) poderia ser cacheada.
5. **Gráfico SVG manual** — leve, sem dependência. Bom. Escala mal se precisar de mais tipos de gráfico.

---

## 12. Problemas de modelagem

**Bem modelado:**

- `imc` como coluna gerada (`generated always as ... stored`) — impossível ficar dessincronizado.
- Snapshot em `meal_items` com `food_id on delete set null` — histórico preservado, rastreabilidade mantida.
- `valores_especiais jsonb` — preserva `traço`/`não analisado` sem poluir o schema.
- `user_id` nullable para alimentos globais em vez de tabela separada — schema mais simples, RLS mais limpo.

**A revisar:**

1. **`anamnesis` é 1:1 com paciente e sobrescrevível.** Uma anamnese de reavaliação sobrescreve a anterior. Perde-se histórico clínico. Deveria ser versionada (1:N com data).
2. **Sem `deleted_at`** em nenhuma tabela.
3. **`foods.categoria` é texto livre** — vindo da TACO usa a taxonomia oficial (15 categorias); vindo do cadastro manual usa a lista do formulário. Duas taxonomias no mesmo campo. Vai atrapalhar filtros.
4. **`meals.horario` é `time` sem timezone** — correto para "horário da refeição", mas confirmar que nunca será tratado como timestamp.
5. **Sem tabela de receitas** — a visão do produto prevê receitas com ingredientes e rendimento. É uma entidade distinta de `foods` (uma receita tem ingredientes, uma porção e um rendimento). Modelar antes de improvisar sobre `foods`.
6. **`profiles` não tem** logo, assinatura, carimbo, telefone, endereço — necessários para documentos.

---

## 13. Riscos técnicos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Erro silencioso no cálculo de macros chega a paciente real | Média | **Muito alto** | Testes unitários de `nutrition.ts` (Fase 1) |
| R2 | Exclusão acidental de paciente perde histórico clínico | Média | Alto | Soft delete + confirmação forte |
| R3 | Multi-tenancy tardio força migração de RLS | Alta | Alto | Decidir modelo antes da Fase 5 |
| R4 | Licenciamento de TBCA/Tucunduva impede uso comercial | Média | Médio | Verificar **antes** de implementar |
| R5 | Área do paciente exige novo modelo de auth | Alta | Alto | Desenhar junto com multi-tenancy |
| R6 | Tipos manuais divergem do banco sem aviso | Alta | Médio | `supabase gen types` no CI |
| R7 | Comunidade exige moderação e anonimização | Alta | Alto | Não iniciar antes do V2 |

**Sobre R4:** a TACO permite reprodução com citação de fonte (declarado na própria publicação). **TBCA e Tucunduva não foram verificados.** A TBCA (USP) tem termos próprios de uso; a Tabela Tucunduva é obra comercial protegida por direitos autorais e sua redistribuição em um SaaS pago é, à primeira vista, problemática. Isso precisa de verificação jurídica antes de qualquer implementação — não é uma decisão de engenharia.

---

## 14. O que deve ser preservado

1. **Snapshot nutricional em `meal_items`** — decisão correta e difícil de refazer depois.
2. **RLS no banco** — fundação de segurança bem posta.
3. **Padrão Server Components (leitura) + Server Actions (escrita)** — sem camada de API redundante.
4. **`lib/nutrition.ts` centralizado** — cálculo em um lugar só.
5. **Preservação de valores ausentes** (`traço` ≠ 0) — correção nutricional.
6. **Coluna gerada de IMC.**
7. **Estrutura de pastas por domínio.**
8. **Script de importação idempotente** (upsert por `codigo_taco`).

---

## 15. O que deve ser refatorado

| Item | Motivo | Quando |
|---|---|---|
| Tipos do banco → gerados | Manuais divergem sem aviso | Fase 1 |
| Busca `ilike` → full-text ou trigram | Índice GIN atual não é usado | Fase 1 |
| `anamnesis` → versionada | Perde histórico clínico | Fase 3 |
| `foods.categoria` → taxonomia única | Duas taxonomias no mesmo campo | Fase 4 |
| Listagens → paginadas | Não escala | Fase 1 |
| `profiles` → campos de identidade profissional | Bloqueia documentos | Fase 2 |

---

## 16. O que deve ser descartado

- **`.env.production`** — assim que o deploy for via Git.
- **`src/lib/types/database.types.ts` (interface `Database`)** — ficou órfã após a remoção do generic. Manter só os tipos de domínio ou substituir por tipos gerados.
- **Nada mais.** Não há código morto relevante nem funcionalidade duplicada.

---

## 17. Recomendações

### Imediato (antes de qualquer feature nova)

1. **Testes de `lib/nutrition.ts`** — é onde um bug tem consequência clínica.
2. **`error.tsx` + `loading.tsx`** em `(app)` e `(auth)`.
3. **Migrar deploy para Git** e apagar `.env.production`.
4. **SMTP próprio** (Resend/Brevo) — sem isso não há onboarding real.

### Decisões a tomar antes de continuar

Três decisões arquiteturais que ficam caras se adiadas:

1. **Multi-tenancy:** conta individual ou clínica com equipe? Muda o RLS de tudo.
2. **Identidade do paciente:** o paciente será usuário autenticado (área do paciente) ou apenas registro? Muda `patients` e a segurança inteira.
3. **Receitas:** entidade própria ou extensão de `foods`? Recomendo entidade própria.

Recomendo resolver 1 e 2 **agora**, na Fase 1, mesmo que a implementação venha depois — o schema precisa nascer preparado.

### Sobre o escopo

A visão descrita é de um produto de 12-18 meses. O que existe hoje é ~15% dela. O maior risco de produto não é técnico: é **diluir o esforço entre 11 módulos e não terminar nenhum bem**.

Sugestão de foco: o diferencial defensável da AuriNutri não é ter mais funcionalidades que o WebDiet — é ser **mais rápido e mais agradável no fluxo que o nutricionista faz todo dia**, que é *atender um paciente e montar um plano*. Comunidade e biblioteca colaborativa são atraentes, mas só fazem sentido depois de existir uma base de usuários que já usa o produto diariamente.

---

*Auditoria realizada sem alteração de arquivos, conforme instruído.*
