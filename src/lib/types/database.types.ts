export type Sexo = "feminino" | "masculino" | "outro";

export interface Profile {
  id: string;
  nome: string;
  email: string;
  crn: string | null;
  crn_uf: string | null;
  telefone: string | null;
  especialidade: string | null;
  logo_url: string | null;
  assinatura_url: string | null;
  cor_marca: string | null;
  endereco: string | null;
  bio: string | null;
  /** Fuso IANA do profissional (ex. "America/Sao_Paulo") — usado para interpretar/exibir appointments.data_hora. */
  fuso_horario: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: Sexo | null;
  endereco: string | null;
  objetivo: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Tipo de dado sensível a que um consentimento se refere (Fase 7, Bloco A). */
export type TipoConsentimento = "exames" | "fotos" | "dados_clinicos";

/** Como o consentimento foi obtido. */
export type FormaConsentimento = "presencial" | "documento_assinado" | "verbal_registrado";

export interface PatientConsent {
  id: string;
  patient_id: string;
  user_id: string;
  tipo: TipoConsentimento;
  /** true enquanto ativo; revogar seta para false NESTE mesmo registro — nunca edita/apaga o histórico. */
  concedido: boolean;
  data_consentimento: string;
  data_revogacao: string | null;
  forma: FormaConsentimento;
  observacoes: string | null;
  created_at: string;
}

/** Ângulo da foto de evolução — usado para comparar duas datas do MESMO ângulo. */
export type TipoFotoEvolucao = "frente" | "perfil" | "costas";

export interface PatientPhoto {
  id: string;
  patient_id: string;
  user_id: string;
  data_registro: string;
  tipo: TipoFotoEvolucao;
  /** Path no bucket privado 'fotos-evolucao' — nunca uma URL. NULL após exclusão (arquivo removido do storage de verdade). */
  arquivo_path: string | null;
  created_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). O arquivo já foi removido do storage nesse ponto. */
  deleted_at: string | null;
}

export interface Anamnesis {
  id: string;
  patient_id: string;
  user_id: string;
  /** anamnesis é 1:N por paciente — data deste registro específico do histórico. */
  data_registro: string;
  queixa_principal: string | null;
  historico_saude: string | null;
  historico_familiar: string | null;
  habitos_alimentares: string | null;
  atividade_fisica: string | null;
  qualidade_sono: string | null;
  alergias: string | null;
  intolerancias: string | null;
  medicamentos: string | null;
  suplementos: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface AnthropometricAssessment {
  id: string;
  patient_id: string;
  user_id: string;
  data_avaliacao: string;
  peso_kg: number;
  altura_cm: number;
  imc: number;
  circunferencia_cintura_cm: number | null;
  circunferencia_quadril_cm: number | null;
  circunferencia_braco_cm: number | null;
  circunferencia_coxa_cm: number | null;
  circunferencia_pescoco_cm: number | null;
  percentual_gordura: number | null;
  observacoes: string | null;
  created_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

/** Sexo laboratorial usado nas faixas de referência — vocabulário próprio de lab_reference_ranges, distinto de Sexo (patients.sexo usa feminino/masculino/outro). */
export type SexoLaboratorial = "M" | "F" | "ambos";

export interface LabExam {
  id: string;
  patient_id: string;
  user_id: string;
  data_coleta: string;
  laboratorio: string | null;
  /** Path no bucket privado 'profissional' (pasta <user_id>/exames/) — nunca uma URL. */
  arquivo_path: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface LabReferenceRange {
  id: string;
  /** NULL = catálogo global do sistema; preenchido = customização do profissional. */
  user_id: string | null;
  nome_marcador: string;
  unidade: string;
  sexo: SexoLaboratorial;
  idade_min_anos: number | null;
  idade_max_anos: number | null;
  valor_min: number | null;
  valor_max: number | null;
  fonte: string | null;
  created_at: string;
}

export interface LabMarker {
  id: string;
  exam_id: string;
  user_id: string;
  nome_marcador: string;
  valor: number;
  unidade: string;
  /** Snapshot da faixa no momento do registro — nunca uma FK para lab_reference_ranges. */
  referencia_min: number | null;
  referencia_max: number | null;
  /** true quando o profissional ajustou manualmente a faixa sugerida antes de salvar. */
  referencia_editada: boolean;
  /** Sinalização neutra — valor fora de [referencia_min, referencia_max]. Não é rótulo diagnóstico. */
  fora_da_faixa: boolean;
  created_at: string;
}

export type FonteAlimento = "taco" | "personalizado";

/** Fonte de um item de refeição — como FonteAlimento, mais 'receita' (o item veio de uma receita, não de um alimento avulso). */
export type ItemFonte = FonteAlimento | "receita";

/** Motivo pelo qual um valor nutricional não é um número (preservado da fonte original). */
export type ValorEspecial = "traco" | "nao_analisado" | "nao_informado";

export interface Food {
  id: string;
  /** NULL para alimentos globais (TACO); dono do alimento quando personalizado. */
  user_id: string | null;
  nome: string;
  categoria: string;
  marca: string | null;
  fonte: FonteAlimento;
  fonte_descricao: string | null;
  is_global: boolean;
  /** Número do alimento na TACO — usado para importação idempotente. */
  codigo_taco: number | null;
  porcao_referencia_g: number;
  // Macronutrientes centrais — podem ser NULL quando a fonte original não
  // traz o dado (traço / não analisado / não informado). Ver `valores_especiais`.
  calorias_kcal: number | null;
  proteinas_g: number | null;
  carboidratos_g: number | null;
  gorduras_g: number | null;
  fibras_g: number | null;
  // Micronutrientes (todos opcionais, presentes principalmente em alimentos TACO)
  umidade_g: number | null;
  cinzas_g: number | null;
  colesterol_mg: number | null;
  calcio_mg: number | null;
  magnesio_mg: number | null;
  manganes_mg: number | null;
  fosforo_mg: number | null;
  ferro_mg: number | null;
  sodio_mg: number | null;
  potassio_mg: number | null;
  cobre_mg: number | null;
  zinco_mg: number | null;
  retinol_mcg: number | null;
  re_mcg: number | null;
  rae_mcg: number | null;
  tiamina_mg: number | null;
  riboflavina_mg: number | null;
  piridoxina_mg: number | null;
  niacina_mg: number | null;
  vitamina_c_mg: number | null;
  gordura_saturada_g: number | null;
  gordura_monoinsaturada_g: number | null;
  gordura_poliinsaturada_g: number | null;
  /** Mapa {coluna: motivo} para valores não numéricos da fonte original. */
  valores_especiais: Partial<Record<string, ValorEspecial>>;
  created_at: string;
  updated_at: string;
  /** Reservado para uso futuro — deleteFood continua fazendo hard delete, nunca é setado hoje. */
  deleted_at: string | null;
}

export interface MealPlan {
  id: string;
  patient_id: string;
  user_id: string;
  nome: string;
  data_inicio: string;
  ativo: boolean;
  observacoes: string | null;
  /** Metas nutricionais diárias do plano (opcionais) — comparadas ao total calculado dos itens. */
  meta_kcal: number | null;
  meta_proteinas_g: number | null;
  meta_carboidratos_g: number | null;
  meta_gorduras_g: number | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface Meal {
  id: string;
  meal_plan_id: string;
  user_id: string;
  nome: string;
  horario: string | null;
  ordem: number;
  observacoes: string | null;
  created_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface MealItem {
  id: string;
  meal_id: string;
  /** Referência de rastreabilidade; pode ser NULL se o alimento original foi excluído, ou se o item é uma receita (ver recipe_id). Mutuamente exclusivo com recipe_id. */
  food_id: string | null;
  /** Referência de rastreabilidade a uma receita; pode ser NULL se a receita original foi excluída, ou se o item é um alimento avulso (ver food_id). Mutuamente exclusivo com food_id. */
  recipe_id: string | null;
  user_id: string;
  quantidade_g: number;
  /** Quantidade em porções da receita, como o profissional digita — NULL para itens de alimento avulso. quantidade_g é derivado a partir deste valor. */
  quantidade_porcoes: number | null;
  ordem: number;
  // Snapshot nutricional no momento em que o item foi adicionado — garante
  // que o plano alimentar nunca mude se o alimento/receita de origem for
  // editado ou excluído posteriormente. Para um item de receita,
  // porcao_referencia_g é os gramas de UMA porção e os macros já refletem
  // eventuais valores_sobrescritos da receita naquele momento.
  nome_alimento: string;
  fonte_alimento: ItemFonte;
  fonte_descricao_alimento: string | null;
  porcao_referencia_g: number;
  calorias_kcal: number;
  proteinas_g: number;
  carboidratos_g: number;
  gorduras_g: number;
  fibras_g: number;
  /** Só para itens de receita: snapshot do conjunto de fontes (taco/personalizado) usadas pelos ingredientes no momento da inclusão — usado na atribuição de fonte do plano/PDF. */
  fontes_ingredientes_receita: FonteAlimento[] | null;
  created_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface Recipe {
  id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  modo_preparo: string | null;
  imagem_url: string | null;
  /** Peso da preparação PRONTA, informado pelo profissional na Etapa 4 — NULL enquanto a receita é rascunho. Nunca calculado pela soma dos ingredientes. */
  rendimento_g: number | null;
  /** Informado na Etapa 4 — NULL enquanto a receita é rascunho. */
  numero_porcoes: number | null;
  tempo_preparo_min: number | null;
  tags: string[];
  /** {campo: valor} — usado quando o profissional prefere digitar um valor à mão em vez do calculado. */
  valores_sobrescritos: Partial<Record<string, number>>;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  /** Referência de rastreabilidade; pode ser NULL se o alimento original foi excluído. */
  food_id: string | null;
  user_id: string;
  quantidade_g: number;
  ordem: number;
  // Snapshot nutricional no momento em que o ingrediente foi incluído —
  // mesmo princípio de MealItem: a receita nunca muda se o alimento de
  // origem for editado ou excluído depois.
  nome_alimento: string;
  fonte_alimento: FonteAlimento;
  fonte_descricao_alimento: string | null;
  porcao_referencia_g: number;
  calorias_kcal: number;
  proteinas_g: number;
  carboidratos_g: number;
  gorduras_g: number;
  fibras_g: number;
  // Micronutrientes — snapshot, iguais aos de Food, podem ser NULL (ver valores_especiais).
  umidade_g: number | null;
  cinzas_g: number | null;
  colesterol_mg: number | null;
  calcio_mg: number | null;
  magnesio_mg: number | null;
  manganes_mg: number | null;
  fosforo_mg: number | null;
  ferro_mg: number | null;
  sodio_mg: number | null;
  potassio_mg: number | null;
  cobre_mg: number | null;
  zinco_mg: number | null;
  retinol_mcg: number | null;
  re_mcg: number | null;
  rae_mcg: number | null;
  tiamina_mg: number | null;
  riboflavina_mg: number | null;
  piridoxina_mg: number | null;
  niacina_mg: number | null;
  vitamina_c_mg: number | null;
  gordura_saturada_g: number | null;
  gordura_monoinsaturada_g: number | null;
  gordura_poliinsaturada_g: number | null;
  /** Snapshot do mapa {coluna: motivo} do alimento de origem — preserva traço/não analisado/não informado. */
  valores_especiais: Partial<Record<string, ValorEspecial>>;
  created_at: string;
}

export interface MealTemplate {
  id: string;
  user_id: string;
  nome: string;
  created_at: string;
}

export interface MealTemplateItem {
  id: string;
  meal_template_id: string;
  /** NULL se o alimento original foi excluído — item ignorado ao aplicar o template. */
  food_id: string | null;
  user_id: string;
  quantidade_g: number;
  ordem: number;
  created_at: string;
}

export interface PlanShareToken {
  id: string;
  meal_plan_id: string;
  user_id: string;
  token: string;
  storage_path: string;
  signed_url: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export type DocumentShareTipo = "antropometria" | "receita" | "arquivo";

export interface DocumentShareToken {
  id: string;
  user_id: string;
  patient_id: string;
  tipo: DocumentShareTipo;
  referencia_id: string | null;
  titulo: string;
  token: string;
  storage_path: string;
  signed_url: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export type AppointmentTipo = "primeira_consulta" | "retorno" | "avaliacao" | "outro";
export type AppointmentStatus = "agendado" | "confirmado" | "realizado" | "faltou" | "cancelado";

export interface Appointment {
  id: string;
  patient_id: string;
  user_id: string;
  /** Instante absoluto (UTC). Interpretar/exibir com o fuso de profiles.fuso_horario — ver src/lib/timezone.ts. */
  data_hora: string;
  /** data_hora + duracao_min, gravado explicitamente pela aplicação — usado pela exclusion constraint anti-sobreposição (migration 0012). */
  data_fim: string;
  duracao_min: number;
  tipo: AppointmentTipo;
  status: AppointmentStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

/** Appointment com o nome do paciente já embutido (join), para exibição na agenda. */
export interface AppointmentWithPatient extends Appointment {
  patients: { nome: string } | null;
}

export interface Task {
  id: string;
  user_id: string;
  patient_id: string | null;
  appointment_id: string | null;
  titulo: string;
  descricao: string | null;
  concluida: boolean;
  /** Data (yyyy-mm-dd), sem horário — não precisa da precisão de fuso de appointments.data_hora. */
  data_limite: string | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export interface MealItemSubstitution {
  id: string;
  meal_item_id: string;
  food_id: string | null;
  user_id: string;
  quantidade_g: number;
  ordem: number;
  nome_alimento: string;
  fonte_alimento: FonteAlimento;
  fonte_descricao_alimento: string | null;
  porcao_referencia_g: number;
  calorias_kcal: number;
  proteinas_g: number;
  carboidratos_g: number;
  gorduras_g: number;
  fibras_g: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Fase 9 — Financeiro (Bloco A: backend)
// ----------------------------------------------------------------------------

export type ExpenseRecorrencia = "unica" | "mensal" | "trimestral" | "semestral" | "anual";

export type ExpenseParcelamento = "avista" | "parcelado";

export interface Expense {
  id: string;
  user_id: string;
  descricao: string;
  categoria: string;
  valor: number;
  recorrencia: ExpenseRecorrencia;
  /** Só usado quando recorrencia <> 'unica'. */
  dia_vencimento: number | null;
  /** Só usado quando recorrencia é trimestral/semestral/anual — mensal recorre todo mês, não precisa fixar um. */
  mes_vencimento: number | null;
  /** Só usado quando recorrencia = 'unica'. */
  data_vencimento: string | null;
  /** Etiqueta informativa (só trimestral/semestral/anual) — não divide valor nem gera parcelas reais. */
  parcelamento: ExpenseParcelamento | null;
  /** Despesa recorrente encerrada (sem apagar histórico) — não é a mesma coisa que deleted_at. */
  ativa: boolean;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

/** Histórico de vencimentos/pagamentos de uma despesa — equivalente de Payment, mas para despesas do consultório. */
export interface ExpenseOccurrence {
  id: string;
  expense_id: string;
  user_id: string;
  /** Snapshot do valor no momento em que a ocorrência foi gerada. */
  valor: number;
  data_vencimento: string;
  /** "Pendente" é derivado disto (data_pagamento is null) — nunca uma coluna de status própria. */
  data_pagamento: string | null;
  forma_pagamento: FormaPagamento | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type PatientBillingTipo = "avulso" | "pacote";

/** O acordo de cobrança com o paciente. As parcelas/recebimentos ficam em Payment. */
export interface PatientBilling {
  id: string;
  patient_id: string;
  user_id: string;
  tipo: PatientBillingTipo;
  descricao: string;
  valor_total: number;
  /** Só para tipo = 'pacote'. */
  numero_consultas: number | null;
  data_inicio: string;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

export type FormaPagamento = "pix" | "dinheiro" | "cartao" | "transferencia" | "outro";

export interface Payment {
  id: string;
  billing_id: string;
  user_id: string;
  valor: number;
  data_vencimento: string;
  /** "Pendente" é derivado disto (data_pagamento is null) — nunca uma coluna de status própria. */
  data_pagamento: string | null;
  forma_pagamento: FormaPagamento | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
}

/** Payment com o nome do paciente e a descrição da cobrança já embutidos (join), para telas de listagem. */
export interface PaymentWithBilling extends Payment {
  patient_billings: { descricao: string; tipo: PatientBillingTipo; patients: { nome: string } | null } | null;
}
