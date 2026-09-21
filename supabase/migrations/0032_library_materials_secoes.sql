-- ============================================================================
-- 0032_library_materials_secoes.sql
--
-- Ajuste pós-uso (Fase 10, biblioteca pessoal): o campo único "Conteúdo" do
-- material escrito era simples demais pra quem não está acostumado a digitar
-- sintaxe (tinha que lembrar "# " pra título e "- " pra lista). Substituído
-- por uma estrutura guiada — título da seção, subtítulo da seção e o texto
-- livre em si — mais fácil de aprender pra quem nunca usou. O texto livre
-- mantém só o negrito (**texto**), que é intuitivo e não exige lembrar de
-- nenhuma sintaxe de linha.
--
-- Os dois campos novos são opcionais e só fazem sentido quando o material é
-- do tipo "escrito" (conteudo not null) — nenhum CHECK novo, o profissional
-- pode perfeitamente escrever só o texto livre sem título/subtítulo.
-- ============================================================================

alter table public.library_materials
  add column if not exists secao_titulo text,
  add column if not exists secao_subtitulo text;

comment on column public.library_materials.secao_titulo is 'Título da seção dentro do conteúdo escrito (opcional) — distinto de library_materials.titulo (o nome do material, exibido na listagem). Só relevante quando conteudo não é null.';
comment on column public.library_materials.secao_subtitulo is 'Subtítulo da seção dentro do conteúdo escrito (opcional). Só relevante quando conteudo não é null.';
