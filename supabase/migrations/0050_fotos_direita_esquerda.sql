-- ============================================================================
-- 0050 — Fase 19 (Roadmap 2): ângulos "À direita" e "À esquerda" nas fotos de
-- evolução, no lugar de "Perfil" (pedido de 05/10/2026).
--
-- Fotos novas passam a ser 'frente' | 'direita' | 'esquerda' | 'costas'.
-- 'perfil' CONTINUA aceito: as fotos já gravadas assim não dizem de que lado
-- foram tiradas, então não são convertidas (seria chutar). A aplicação não
-- oferece mais 'perfil' no envio (validação em src/lib/validations/patient-photo.ts),
-- só mostra as antigas como "Perfil".
--
-- O check original era inline (0022), com o nome automático
-- patient_photos_tipo_check. O novo tem nome próprio, diferente desse, para
-- não esbarrar no nome automático (ver o caso da 0026).
--
-- Seguro de aplicar com o site no ar: nenhum dado muda, só a regra aceita mais
-- dois valores.
-- ============================================================================

alter table public.patient_photos drop constraint if exists patient_photos_tipo_check;

alter table public.patient_photos
  add constraint patient_photos_tipo_valido
  check (tipo in ('frente', 'direita', 'esquerda', 'costas', 'perfil'));

comment on column public.patient_photos.tipo is
  'frente | direita | esquerda | costas — usado para comparar duas datas do MESMO ângulo. perfil: só fotos antigas (antes da 0050), sem lado.';
