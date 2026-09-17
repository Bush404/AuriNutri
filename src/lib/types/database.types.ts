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

export type FonteAlimento = "taco" | "personalizado";

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
  /** Referência de rastreabilidade; pode ser NULL se o alimento original foi excluído. */
  food_id: string | null;
  user_id: string;
  quantidade_g: number;
  ordem: number;
  // Snapshot nutricional no momento em que o item foi adicionado — garante
  // que o plano alimentar nunca mude se o alimento de origem for editado
  // ou excluído posteriormente.
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
  /** Soft delete: não-nulo = excluído (invisível via RLS). */
  deleted_at: string | null;
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
