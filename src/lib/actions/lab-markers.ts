"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { labMarkerSchema, type LabMarkerInput } from "@/lib/validations/lab-exam";
import type { ActionResult } from "@/lib/actions/patients";
import type { LabReferenceRange, Patient, SexoLaboratorial } from "@/lib/types/database.types";
import { calculateAge } from "@/lib/utils";
import { resolveReferenceRange, type ReferenceRangeOption } from "@/lib/lab-reference";

export type { ReferenceRangeOption } from "@/lib/lab-reference";

export async function addLabMarker(patientId: string, examId: string, input: LabMarkerInput): Promise<ActionResult> {
  const parsed = labMarkerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Informe o marcador, o valor e a unidade." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.from("lab_markers").insert({
    exam_id: examId,
    user_id: user.id,
    nome_marcador: parsed.data.nome_marcador,
    valor: parsed.data.valor,
    unidade: parsed.data.unidade,
    referencia_min: parsed.data.referencia_min ?? null,
    referencia_max: parsed.data.referencia_max ?? null,
    referencia_editada: parsed.data.referencia_editada,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Marcador registrado." };
}

/** Sem deleted_at própria (mesmo padrão de recipe_ingredients) — remover um marcador é exclusão real da linha. */
export async function deleteLabMarker(patientId: string, markerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("lab_markers").delete().eq("id", markerId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true, message: "Marcador removido." };
}

export interface ReferenceRangeSuggestion {
  /**
   * true quando o sexo do paciente é 'outro' ou não informado — faixas
   * laboratoriais só existem para masculino/feminino, então o sistema NÃO
   * escolhe uma por conta própria (mesmo cuidado do cálculo de gasto
   * energético): a UI deve mostrar as opções e pedir que o profissional
   * selecione qual usar.
   */
  precisaEscolherSexo: boolean;
  opcoes: ReferenceRangeOption[];
}

/** Busca candidatos no banco (nome_marcador + sexo compatível) e delega a escolha a resolveReferenceRange (função pura, testada em lab-reference.test.ts). */
async function resolverParaSexo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  nomeMarcador: string,
  sexoBucket: "M" | "F",
  idade: number | null
): Promise<ReferenceRangeOption | null> {
  // ilike sem "%" = comparação exata só que sem diferenciar maiúsculas de
  // minúsculas — o profissional pode digitar o nome livremente (não é
  // obrigado a clicar na sugestão do catálogo) e ainda assim encontrar a
  // faixa se o texto bater, só que com uma letra maiúscula diferente.
  const { data } = await supabase
    .from("lab_reference_ranges")
    .select("*")
    .ilike("nome_marcador", nomeMarcador)
    .in("sexo", [sexoBucket, "ambos"])
    .returns<LabReferenceRange[]>();

  if (!data || data.length === 0) return null;

  return resolveReferenceRange(data, userId, sexoBucket, idade);
}

/**
 * Busca a faixa de referência sugerida para um marcador, cruzando
 * nome_marcador + sexo do paciente + idade calculada a partir de
 * patients.data_nascimento — pré-preenche referencia_min/referencia_max no
 * formulário; o profissional pode sobrescrever antes de salvar.
 */
export async function getReferenceRangeSuggestion(
  patientId: string,
  nomeMarcador: string
): Promise<ReferenceRangeSuggestion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !nomeMarcador.trim()) {
    return { precisaEscolherSexo: false, opcoes: [] };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("sexo, data_nascimento")
    .eq("id", patientId)
    .maybeSingle<Pick<Patient, "sexo" | "data_nascimento">>();

  const idade = patient?.data_nascimento ? calculateAge(patient.data_nascimento) : null;
  const sexoBucket: "M" | "F" | null =
    patient?.sexo === "masculino" ? "M" : patient?.sexo === "feminino" ? "F" : null;

  if (sexoBucket) {
    const opcao = await resolverParaSexo(supabase, user.id, nomeMarcador, sexoBucket, idade);
    return { precisaEscolherSexo: false, opcoes: opcao ? [opcao] : [] };
  }

  // sexo 'outro' ou não informado: nunca escolhemos por conta própria —
  // MAS só pedimos pra escolher quando a faixa realmente muda por sexo. Um
  // marcador como "Glicemia de jejum" (sexo 'ambos' no catálogo) resolve
  // igual para M e F; nesse caso não faz sentido perguntar.
  const [masculino, feminino] = await Promise.all([
    resolverParaSexo(supabase, user.id, nomeMarcador, "M", idade),
    resolverParaSexo(supabase, user.id, nomeMarcador, "F", idade),
  ]);

  const mesmaFaixaParaOsDoisSexos =
    masculino !== null &&
    feminino !== null &&
    masculino.valor_min === feminino.valor_min &&
    masculino.valor_max === feminino.valor_max &&
    masculino.unidade === feminino.unidade;

  if (mesmaFaixaParaOsDoisSexos) {
    return { precisaEscolherSexo: false, opcoes: [masculino] };
  }

  const opcoes = [masculino, feminino].filter((o): o is ReferenceRangeOption => o !== null);
  return { precisaEscolherSexo: opcoes.length > 0, opcoes };
}

export interface SaveReferenceRangeInput {
  nome_marcador: string;
  unidade: string;
  sexo: SexoLaboratorial;
  valor_min: number | null;
  valor_max: number | null;
  fonte?: string | null;
}

/**
 * Salva (cria ou atualiza) a faixa PESSOAL do profissional para um marcador
 * — "faixa própria" do schema (user_id preenchido em lab_reference_ranges),
 * que passa a prevalecer sobre o catálogo global nas próximas sugestões.
 * Não afeta lab_markers já registrados (snapshot, nunca FK).
 */
export async function saveMyReferenceRange(input: SaveReferenceRangeInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: existente } = await supabase
    .from("lab_reference_ranges")
    .select("id")
    .eq("user_id", user.id)
    .eq("nome_marcador", input.nome_marcador)
    .eq("sexo", input.sexo)
    .maybeSingle<{ id: string }>();

  const payload = {
    unidade: input.unidade,
    valor_min: input.valor_min,
    valor_max: input.valor_max,
    fonte: input.fonte ?? null,
  };

  const { error } = existente
    ? await supabase.from("lab_reference_ranges").update(payload).eq("id", existente.id)
    : await supabase.from("lab_reference_ranges").insert({
        user_id: user.id,
        nome_marcador: input.nome_marcador,
        sexo: input.sexo,
        idade_min_anos: 18,
        idade_max_anos: null,
        ...payload,
      });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Faixa salva como padrão pessoal para este marcador." };
}

export interface MarkerCatalogEntry {
  nome_marcador: string;
  unidade: string;
}

/**
 * Lista os nomes de marcador distintos do catálogo (global + pessoal do
 * profissional) para a busca do formulário de resultado — RLS já limita a
 * global ou própria. Um mesmo marcador pode ter mais de uma linha (M/F);
 * aqui aparece só uma vez.
 */
export async function listReferenceMarkerCatalog(): Promise<MarkerCatalogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lab_reference_ranges")
    .select("nome_marcador, unidade")
    .order("nome_marcador")
    .returns<MarkerCatalogEntry[]>();

  if (!data) return [];

  const vistos = new Set<string>();
  const unicos: MarkerCatalogEntry[] = [];
  for (const item of data) {
    if (vistos.has(item.nome_marcador)) continue;
    vistos.add(item.nome_marcador);
    unicos.push(item);
  }
  return unicos;
}
