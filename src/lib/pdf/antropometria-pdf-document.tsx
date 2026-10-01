import { Circle, Document, Image, Line, Page, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import { IDADE_IDOSO, type Classificacao, type SexoParaFormula } from "@/lib/anthropometry";
import type { ResultadosAvaliacao } from "@/lib/anthropometry-results";
import type { PontoEvolucao } from "@/lib/evolution";
import {
  formatarIdadeMeses,
  INDICADOR_LABELS,
  type ResultadoGorduraInfantil,
  type ResultadosCrianca,
} from "@/lib/growth/growth";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

/**
 * "Relatório antropométrico" de UMA avaliação (botão Relatório e Central de
 * Envio) — formato pedido pela nutricionista em 30/09/2026, a partir do
 * WebDiet: índices em barras Abaixo/Normal/Acima, histórico das últimas
 * avaliações e conceitos explicados para o paciente. Os números vêm de
 * `calcularResultados` — os mesmos da tela.
 */

export interface AntropometriaPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  geradoEm: string;
  assessment: AnthropometricAssessment;
  resultados: ResultadosAvaliacao;
  /** Últimas avaliações até esta (inclusive), da mais antiga para a mais recente. */
  historico?: { datas: string[]; peso: PontoEvolucao[]; massa_muscular: PontoEvolucao[]; percentual_gordura: PontoEvolucao[] };
  /** Presente só em avaliação de criança/adolescente (tipo 'crianca'). */
  crianca?: { resultados: ResultadosCrianca | null; gordura: ResultadoGorduraInfantil | null };
}

const VERDE = "#1f7a5c";
const CINZA = "#5f6f68";
const BARRA = "#6b7570";
const LARG_ESCALA = 300;

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 80, fontSize: 9.5, fontFamily: "Helvetica", color: "#16211c" },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 56, height: 56, objectFit: "contain" },
  profissional: { alignItems: "flex-end" },
  profissionalNome: { fontSize: 11, fontWeight: 700, color: VERDE },
  profissionalDetalhe: { fontSize: 8.5, color: CINZA, marginTop: 2 },
  paciente: { fontSize: 14, fontWeight: 700, textAlign: "center", marginTop: 6 },
  subtitulo: { fontSize: 10, textAlign: "center", color: "#33413b", marginTop: 2, marginBottom: 12 },
  faixa: { fontSize: 11, fontWeight: 700, backgroundColor: "#eef2f0", paddingVertical: 5, paddingHorizontal: 8, marginTop: 10, marginBottom: 6 },
  escalaTopo: { flexDirection: "row", marginLeft: 150, width: LARG_ESCALA, marginBottom: 6 },
  escalaCelula: { flex: 1, fontSize: 8, color: "#ffffff", textAlign: "center", paddingVertical: 2 },
  indice: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  indiceLabel: { width: 150, fontSize: 9 },
  indiceBarraFundo: { width: LARG_ESCALA + 70, flexDirection: "row", alignItems: "center" },
  indiceValor: { fontSize: 8.5, marginLeft: 6 },
  historicoLinha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cfd8d4", minHeight: 52 },
  historicoLabel: { width: 130, backgroundColor: "#e8ecea", padding: 6, justifyContent: "center" },
  historicoNome: { fontSize: 9, fontWeight: 700 },
  historicoUnidade: { fontSize: 7.5, color: CINZA },
  historicoGrafico: { flex: 1, position: "relative" },
  rotuloPonto: { position: "absolute", fontSize: 7, width: 40, textAlign: "center" },
  datasLinha: { flexDirection: "row", marginLeft: 130, position: "relative" },
  dataItem: { fontSize: 7, color: CINZA, position: "absolute", width: 50, textAlign: "center" },
  conceito: { fontSize: 8.5, marginBottom: 5, lineHeight: 1.35 },
  conceitoTitulo: { fontWeight: 700 },
  linha: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#f0f4f2" },
  rotulo: { flex: 1.4, fontSize: 9, color: "#33413b" },
  valor: { flex: 1, fontSize: 9, textAlign: "right", fontWeight: 700 },
  classificacao: { flex: 1.3, fontSize: 8.5, textAlign: "right", color: CINZA },
  nota: { fontSize: 7.5, color: CINZA, marginTop: 2 },
  observacoes: { fontSize: 9, color: "#33413b" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 6 },
  footerAssinatura: { alignItems: "center" },
  assinaturaImg: { width: 90, height: 32, objectFit: "contain" },
  assinaturaNome: { fontSize: 7.5, color: CINZA, marginTop: 2, textAlign: "center" },
});

function num(value: number | null | undefined, casas = 1, unidade = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${unidade}`;
}

// ---------------------------------------------------------------------------
// Índices em barra (Abaixo | Normal | Acima)
// ---------------------------------------------------------------------------

/** Posição 0..1 na escala de três terços: abaixo de `min`, normal até `max`, acima disso. */
export function posicaoNaEscala(v: number, min: number, max: number) {
  if (v < min) return Math.max(0.03, (v / min) * (1 / 3));
  if (v <= max) return 1 / 3 + ((v - min) / (max - min || 1)) * (1 / 3);
  return 2 / 3 + Math.min((v - max) / (max * 0.5 || 1), 1) * (1 / 3);
}

interface Indice {
  label: string;
  valor: number | null;
  texto: string;
  faixa: [number, number] | null;
}

/** Faixa "normal" do % de gordura: do fim do risco por baixo até a média (Lohman, 1992). */
const FAIXA_GORDURA: Record<SexoParaFormula, [number, number]> = { masculino: [6, 16], feminino: [9, 24] };

function indicesAdulto(a: AnthropometricAssessment, r: ResultadosAvaliacao): Indice[] {
  const idoso = r.idade !== null && r.idade >= IDADE_IDOSO;
  const g = r.gordura?.ok ? r.gordura.percentualGordura : a.percentual_gordura ?? a.bio_percentual_gordura;
  const fg = r.sexo ? FAIXA_GORDURA[r.sexo] : null;
  const massaGorda = g !== null && g !== undefined ? (a.peso_kg * g) / 100 : null;
  return [
    {
      label: "Massa corporal total",
      valor: a.peso_kg,
      texto: num(a.peso_kg, 1, " kg"),
      faixa: r.pesoIdeal ? [r.pesoIdeal.minKg, r.pesoIdeal.maxKg] : null,
    },
    { label: "Índice de massa corporal (IMC)", valor: r.imc, texto: num(r.imc, 1, " kg/m²"), faixa: idoso ? [22, 27] : [18.5, 24.9] },
    {
      label: "Relação cintura/quadril",
      valor: r.rcq,
      texto: num(r.rcq, 2),
      faixa: r.sexo ? [0.6, r.sexo === "masculino" ? 0.9 : 0.85] : null,
    },
    { label: "Relação cintura/estatura", valor: r.rcest, texto: num(r.rcest, 2), faixa: [0.4, 0.5] },
    { label: "Percentual de gordura", valor: g ?? null, texto: num(g, 1, "%"), faixa: fg },
    {
      label: "Massa de gordura",
      valor: massaGorda,
      texto: num(massaGorda, 1, " kg"),
      faixa: fg ? [(a.peso_kg * fg[0]) / 100, (a.peso_kg * fg[1]) / 100] : null,
    },
  ];
}

function Indices({ indices }: { indices: Indice[] }) {
  return (
    <View>
      <View style={styles.escalaTopo}>
        <Text style={[styles.escalaCelula, { backgroundColor: BARRA }]}>Abaixo</Text>
        <Text style={[styles.escalaCelula, { backgroundColor: "#c9cfcc", color: "#16211c" }]}>Normal</Text>
        <Text style={[styles.escalaCelula, { backgroundColor: BARRA }]}>Acima</Text>
      </View>
      {indices.map((i) => {
        const p = i.valor !== null && i.faixa ? posicaoNaEscala(i.valor, i.faixa[0], i.faixa[1]) : null;
        return (
          <View key={i.label} style={styles.indice} wrap={false}>
            <Text style={styles.indiceLabel}>{i.label}</Text>
            <View style={styles.indiceBarraFundo}>
              {p !== null ? (
                <View style={{ width: LARG_ESCALA * p, height: 8, backgroundColor: BARRA, borderRadius: 4 }} />
              ) : (
                <View style={{ width: 8, height: 8, backgroundColor: "#c9cfcc", borderRadius: 4 }} />
              )}
              <Text style={styles.indiceValor}>{i.texto}</Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.nota}>
        Faixas: peso e IMC pela OMS (60 anos ou mais: Lipschitz); RCQ pela OMS; RCEst por Ashwell; % de gordura por Lohman.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Histórico (mini gráficos com as mesmas datas)
// ---------------------------------------------------------------------------

const LARG_HIST = 400;
const ALT_HIST = 48;

function Historico({ historico }: { historico: NonNullable<AntropometriaPdfViewModel["historico"]> }) {
  const n = historico.datas.length;
  const x = (data: string) => {
    const i = historico.datas.indexOf(data);
    return n === 1 ? LARG_HIST / 2 : 24 + (i / (n - 1)) * (LARG_HIST - 48);
  };
  const series: [string, string, PontoEvolucao[]][] = [
    ["Peso", "kg", historico.peso],
    ["Massa muscular", "kg", historico.massa_muscular],
    ["Percentual de gordura", "%", historico.percentual_gordura],
  ];

  return (
    <View>
      {series.map(([nome, unidade, pontos]) => {
        const vs = pontos.map((p) => p.valor);
        const min = Math.min(...vs);
        const max = Math.max(...vs);
        const faixa = max - min || 1;
        const y = (v: number) => ALT_HIST - 8 - ((v - min) / faixa) * (ALT_HIST - 22);
        return (
          <View key={nome} style={styles.historicoLinha} wrap={false}>
            <View style={styles.historicoLabel}>
              <Text style={styles.historicoNome}>{nome}</Text>
              <Text style={styles.historicoUnidade}>({unidade})</Text>
            </View>
            <View style={styles.historicoGrafico}>
              {pontos.length === 0 ? (
                <Text style={[styles.nota, { margin: 6 }]}>Sem medidas nas últimas avaliações.</Text>
              ) : (
                <>
                  <Svg width={LARG_HIST} height={ALT_HIST} viewBox={`0 0 ${LARG_HIST} ${ALT_HIST}`}>
                    {pontos.length > 1 && (
                      <Polyline
                        points={pontos.map((p) => `${x(p.data).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ")}
                        stroke="#16211c"
                        strokeWidth={1.5}
                        fill="none"
                      />
                    )}
                    {pontos.map((p, i) => (
                      <Circle key={`${p.data}-${i}`} cx={x(p.data)} cy={y(p.valor)} r={2.5} fill="#16211c" />
                    ))}
                  </Svg>
                  {pontos.map((p, i) => (
                    <Text key={`${p.data}-${i}`} style={[styles.rotuloPonto, { left: x(p.data) - 20, top: y(p.valor) - 12 }]}>
                      {num(p.valor, 1)}
                    </Text>
                  ))}
                </>
              )}
            </View>
          </View>
        );
      })}
      <View style={[styles.datasLinha, { height: 14 }]}>
        <Svg width={LARG_HIST} height={4} viewBox={`0 0 ${LARG_HIST} 4`}>
          <Line x1={0} y1={2} x2={LARG_HIST} y2={2} stroke="#cfd8d4" strokeWidth={0.5} />
        </Svg>
        {[...new Set(historico.datas)].map((d) => (
          <Text key={d} style={[styles.dataItem, { left: x(d) - 25, top: 4 }]}>
            {formatDate(d)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Conceitos explicados ao paciente (texto próprio do AuriNutri)
// ---------------------------------------------------------------------------

const CONCEITOS: [string, string][] = [
  ["Massa corporal total", "é o peso do corpo inteiro: gordura, músculos, ossos, órgãos e água, medido na balança."],
  [
    "Índice de massa corporal (IMC)",
    "relaciona o peso com a altura (peso ÷ altura²). É útil para acompanhar faixas de peso, mas não separa gordura de músculo — por isso é olhado junto com as outras medidas.",
  ],
  [
    "Relação cintura/quadril e cintura/estatura",
    "comparam a cintura com o quadril e com a altura. Valores mais altos indicam mais gordura na região da barriga, ligada a maior risco cardiovascular e metabólico.",
  ],
  [
    "Percentual e massa de gordura",
    "mostram quanto do peso é gordura. Um pouco de gordura é essencial ao corpo; o excesso, principalmente na região abdominal, aumenta riscos à saúde.",
  ],
  [
    "Massa muscular",
    "é a parte do peso formada pelos músculos. Mantê-la ou aumentá-la ajuda no metabolismo, na força e na saúde ao longo da vida.",
  ],
  [
    "Bioimpedância",
    "é um exame em balança ou aparelho que passa uma corrente elétrica fraca pelo corpo para estimar gordura, massa magra e água.",
  ],
];

function Conceitos() {
  return (
    <View>
      {CONCEITOS.map(([titulo, texto]) => (
        <Text key={titulo} style={styles.conceito} wrap={false}>
          <Text style={styles.conceitoTitulo}>{titulo}: </Text>
          {texto}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Criança/adolescente
// ---------------------------------------------------------------------------

function Linha({ rotulo, valor, c }: { rotulo: string; valor: string; c?: Classificacao | null }) {
  return (
    <View style={styles.linha} wrap={false}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
      <Text style={styles.classificacao}>{c ? `${c.label} (${c.fonte})` : ""}</Text>
    </View>
  );
}

function SecaoCrianca({ a, crianca }: { a: AnthropometricAssessment; crianca: NonNullable<AntropometriaPdfViewModel["crianca"]> }) {
  const r = crianca.resultados;
  const g = crianca.gordura;
  return (
    <View>
      <Text style={styles.faixa}>Crescimento (OMS){r ? ` — ${formatarIdadeMeses(r.meses)}` : ""}</Text>
      <Linha rotulo={r && r.meses < 24 ? "Comprimento" : "Altura"} valor={num(a.altura_cm, 1, " cm")} />
      <Linha rotulo="Peso" valor={num(a.peso_kg, 1, " kg")} />
      <Linha rotulo="IMC" valor={num(r?.imc, 2, " kg/m²")} />
      {r?.indicadores.map((i) => (
        <Linha
          key={i.indicador}
          rotulo={INDICADOR_LABELS[i.indicador]}
          valor={`z ${i.z >= 0 ? "+" : ""}${num(i.z, 2)} · P${num(i.percentil, 1)}`}
          c={i.classificacao}
        />
      ))}
      {g?.ok && <Linha rotulo={`% de gordura (${g.dobras})`} valor={num(g.percentualGordura, 1, "%")} c={g.classificacao} />}
      <Text style={styles.nota}>Curvas: OMS 2006 (0–5 anos) e 2007 (5–19 anos); classificação SISVAN, 2008.</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

export function AntropometriaPdfDocument({ data }: { data: AntropometriaPdfViewModel }) {
  const { profissional, assessment: a, resultados: r } = data;

  return (
    <Document title={`Relatório antropométrico - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.topo}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), sem prop alt. */}
          {profissional.logoUrl ? <Image src={profissional.logoUrl} style={styles.logo} /> : <View />}
          <View style={styles.profissional}>
            <Text style={styles.profissionalNome}>{profissional.nome}</Text>
            {(profissional.crn || profissional.crnUf) && (
              <Text style={styles.profissionalDetalhe}>
                CRN {profissional.crn}
                {profissional.crnUf ? `/${profissional.crnUf}` : ""}
              </Text>
            )}
            {profissional.especialidade && <Text style={styles.profissionalDetalhe}>{profissional.especialidade}</Text>}
          </View>
        </View>

        <Text style={styles.paciente}>{data.pacienteNome}</Text>
        <Text style={styles.subtitulo}>
          Relatório antropométrico · {formatDate(a.data_avaliacao)}
          {data.crianca ? "" : r.idade !== null ? ` · ${r.idade} anos` : ""}
        </Text>

        {data.crianca ? (
          <SecaoCrianca a={a} crianca={data.crianca} />
        ) : (
          <View>
            <Text style={styles.faixa}>Análise de índices corporais</Text>
            <Indices indices={indicesAdulto(a, r)} />
          </View>
        )}

        {data.historico && data.historico.datas.length > 0 && (
          <View wrap={false}>
            <Text style={styles.faixa}>Histórico de avaliação</Text>
            <Historico historico={data.historico} />
          </View>
        )}

        {a.observacoes && (
          <View wrap={false}>
            <Text style={styles.faixa}>Observações</Text>
            <Text style={styles.observacoes}>{a.observacoes}</Text>
          </View>
        )}

        <Text style={styles.faixa}>Conceitos</Text>
        <Conceitos />

        <View style={styles.footer} fixed>
          {profissional.assinaturaUrl ? (
            <View style={styles.footerAssinatura}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- ver comentário equivalente acima, no logo. */}
              <Image src={profissional.assinaturaUrl} style={styles.assinaturaImg} />
              <Text style={styles.assinaturaNome}>{profissional.nome}</Text>
            </View>
          ) : (
            <Text style={styles.assinaturaNome}>Gerado em {formatDate(data.geradoEm.slice(0, 10))}</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
