import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import { DOBRA_LABELS, DOBRAS, PROTOCOLO_INFO, type Classificacao } from "@/lib/anthropometry";
import type { ResultadosAvaliacao } from "@/lib/anthropometry-results";
import {
  formatarIdadeMeses,
  INDICADOR_LABELS,
  type ResultadoGorduraInfantil,
  type ResultadosCrianca,
} from "@/lib/growth/growth";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

/**
 * Relatório de UMA avaliação antropométrica (Central de Envio). Os resultados
 * vêm de `calcularResultados` — os mesmos números da tela. Cada seção só
 * aparece se tiver ao menos uma medida preenchida.
 */

export interface AntropometriaPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  geradoEm: string;
  assessment: AnthropometricAssessment;
  resultados: ResultadosAvaliacao;
  /** Presente só em avaliação de criança/adolescente (tipo 'crianca'). */
  crianca?: { resultados: ResultadosCrianca | null; gordura: ResultadoGorduraInfantil | null };
}

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 90, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  pacienteInfo: { fontSize: 10, color: "#33413b", marginBottom: 12 },
  secao: { marginBottom: 12 },
  secaoTitulo: { fontSize: 11, fontWeight: 700, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: "#e2eae6" },
  linha: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#f0f4f2" },
  rotulo: { flex: 1.4, fontSize: 9, color: "#33413b" },
  valor: { flex: 1, fontSize: 9, textAlign: "right", fontWeight: 700 },
  classificacao: { flex: 1.3, fontSize: 8.5, textAlign: "right", color: "#5f6f68" },
  grade: { flexDirection: "row", flexWrap: "wrap" },
  gradeItem: { width: "33.33%", paddingVertical: 2, paddingRight: 8, fontSize: 9 },
  observacoes: { fontSize: 9, color: "#33413b" },
  nota: { fontSize: 7.5, color: "#5f6f68", marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

function num(value: number | null | undefined, casas = 1, unidade = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${unidade}`;
}

function Linha({ rotulo, valor, c }: { rotulo: string; valor: string; c?: Classificacao | null }) {
  return (
    <View style={styles.linha} wrap={false}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
      <Text style={styles.classificacao}>{c ? `${c.label} (${c.fonte})` : ""}</Text>
    </View>
  );
}

function Grade({ titulo, itens }: { titulo: string; itens: [string, number | null][] }) {
  const preenchidos = itens.filter(([, v]) => v !== null);
  if (preenchidos.length === 0) return null;
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      <View style={styles.grade}>
        {preenchidos.map(([label, v]) => (
          <Text key={label} style={styles.gradeItem}>
            {label}: {num(v)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function AntropometriaPdfDocument({ data }: { data: AntropometriaPdfViewModel }) {
  const { profissional, assessment: a, resultados: r } = data;
  const g = r.gordura?.ok ? r.gordura : null;
  const protocolo = a.protocolo_dobras ? PROTOCOLO_INFO[a.protocolo_dobras].label : null;
  const lado = (dir: number | null, esq: number | null): [number | null, number | null] => [dir, esq];

  return (
    <Document title={`Avaliação antropométrica - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.profissionalNome}>{profissional.nome}</Text>
            {(profissional.crn || profissional.crnUf) && (
              <Text style={styles.profissionalDetalhe}>
                CRN {profissional.crn}
                {profissional.crnUf ? `/${profissional.crnUf}` : ""}
              </Text>
            )}
            {profissional.especialidade && <Text style={styles.profissionalDetalhe}>{profissional.especialidade}</Text>}
            {profissional.telefone && <Text style={styles.profissionalDetalhe}>{profissional.telefone}</Text>}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), sem prop alt. */}
          {profissional.logoUrl && <Image src={profissional.logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.titulo}>Avaliação antropométrica</Text>
        <Text style={styles.pacienteInfo}>
          Paciente: {data.pacienteNome}
          {r.idade !== null ? ` · ${r.idade} anos` : ""} · Avaliação de {formatDate(a.data_avaliacao)} · Gerado em{" "}
          {formatDate(data.geradoEm.slice(0, 10))}
        </Text>

        {data.crianca ? (
          <SecaoCrianca a={a} crianca={data.crianca} />
        ) : (
          <>
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Pesos e medidas</Text>
              <Linha rotulo={a.peso_estimado ? "Peso (estimado)" : "Peso"} valor={num(a.peso_kg, 1, " kg")} />
              <Linha rotulo={a.altura_estimada ? "Altura (estimada)" : "Altura"} valor={num(a.altura_cm, 1, " cm")} />
              <Linha rotulo="IMC" valor={num(r.imc, 2, " kg/m²")} c={r.classificacaoImc} />
              {r.pesoIdeal && (
                <Linha rotulo="Faixa de peso ideal" valor={`${num(r.pesoIdeal.minKg)} a ${num(r.pesoIdeal.maxKg, 1, " kg")}`} />
              )}
              {r.rcq !== null && <Linha rotulo="Relação cintura/quadril" valor={num(r.rcq, 2)} c={r.classificacaoRcq} />}
              {r.rcest !== null && <Linha rotulo="Relação cintura/estatura" valor={num(r.rcest, 2)} c={r.classificacaoRcest} />}
              {r.cmb !== null && <Linha rotulo="Circunferência muscular do braço" valor={num(r.cmb, 1, " cm")} />}
              {r.classificacaoCmb && (
                <Linha
                  rotulo="Adequação da CMB"
                  valor={num(r.classificacaoCmb.adequacaoPercentual, 0, "%")}
                  c={r.classificacaoCmb.adequacao}
                />
              )}
              {r.panturrilhaIdoso && <Linha rotulo="Panturrilha" valor="" c={r.panturrilhaIdoso} />}
            </View>

            {(g || a.percentual_gordura !== null || r.pesoOsseoKg !== null) && (
              <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>Composição corporal{protocolo ? ` — ${protocolo}` : ""}</Text>
                <Linha
                  rotulo="% de gordura"
                  valor={num(g ? g.percentualGordura : a.percentual_gordura, 1, "%")}
                  c={r.classificacaoGordura}
                />
                {g && <Linha rotulo="Massa de gordura" valor={num(r.massaGordaKg, 1, " kg")} />}
                {g && <Linha rotulo="Massa livre de gordura" valor={num(r.massaLivreGorduraKg, 1, " kg")} />}
                {r.pesoOsseoKg !== null && <Linha rotulo="Peso ósseo (Rocha, 1975)" valor={num(r.pesoOsseoKg, 1, " kg")} />}
                {g && <Linha rotulo="Peso residual (Würch, 1974)" valor={num(r.pesoResidualKg, 1, " kg")} />}
                {r.massaMuscularKg !== null && <Linha rotulo="Massa muscular" valor={num(r.massaMuscularKg, 1, " kg")} />}
                {g && <Text style={styles.nota}>Fonte: {g.fonte}.</Text>}
              </View>
            )}

            <Grade
              titulo="Dobras cutâneas (mm)"
              itens={DOBRAS.map((d) => [DOBRA_LABELS[d], a[`dobra_${d}_mm` as keyof AnthropometricAssessment] as number | null])}
            />

            <Grade
              titulo="Circunferências (cm)"
              itens={[
                ["Pescoço", a.circunferencia_pescoco_cm],
                ["Tórax", a.circunferencia_torax_cm],
                ["Ombro", a.circunferencia_ombro_cm],
                ["Cintura", a.circunferencia_cintura_cm],
                ["Quadril", a.circunferencia_quadril_cm],
                ["Abdômen", a.circunferencia_abdomen_cm],
                ["Braço", a.circunferencia_braco_cm],
                ["Coxa", a.circunferencia_coxa_cm],
                ...(
                  [
                    ["Braço relaxado", lado(a.circunferencia_braco_relaxado_dir_cm, a.circunferencia_braco_relaxado_esq_cm)],
                    ["Braço contraído", lado(a.circunferencia_braco_contraido_dir_cm, a.circunferencia_braco_contraido_esq_cm)],
                    ["Antebraço", lado(a.circunferencia_antebraco_dir_cm, a.circunferencia_antebraco_esq_cm)],
                    ["Coxa proximal", lado(a.circunferencia_coxa_proximal_dir_cm, a.circunferencia_coxa_proximal_esq_cm)],
                    ["Coxa medial", lado(a.circunferencia_coxa_medial_dir_cm, a.circunferencia_coxa_medial_esq_cm)],
                    ["Coxa distal", lado(a.circunferencia_coxa_distal_dir_cm, a.circunferencia_coxa_distal_esq_cm)],
                    ["Panturrilha", lado(a.circunferencia_panturrilha_dir_cm, a.circunferencia_panturrilha_esq_cm)],
                  ] as [string, [number | null, number | null]][]
                ).flatMap(([label, [dir, esq]]): [string, number | null][] => [
                  [`${label} D`, dir],
                  [`${label} E`, esq],
                ]),
              ]}
            />

            <Grade
              titulo="Diâmetros ósseos (cm)"
              itens={[
                ["Úmero", a.diametro_umero_cm],
                ["Punho", a.diametro_punho_cm],
                ["Fêmur", a.diametro_femur_cm],
              ]}
            />

            <Grade
              titulo="Bioimpedância"
              itens={[
                ["% de gordura", a.bio_percentual_gordura],
                ["Massa de gordura (kg)", a.bio_massa_gorda_kg],
                ["% massa muscular", a.bio_percentual_massa_muscular],
                ["Massa muscular (kg)", a.bio_massa_muscular_kg],
                ["Massa livre de gordura (kg)", a.bio_massa_livre_gordura_kg],
                ["Peso ósseo (kg)", a.bio_peso_osseo_kg],
                ["Gordura visceral", a.bio_gordura_visceral],
                ["Água corporal (%)", a.bio_agua_corporal_percentual],
                ["Idade metabólica", a.bio_idade_metabolica],
              ]}
            />

          </>
        )}

        {a.observacoes && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Observações</Text>
            <Text style={styles.observacoes}>{a.observacoes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          {profissional.assinaturaUrl && (
            <View style={styles.footerAssinatura}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- ver comentário equivalente acima, no logo. */}
              <Image src={profissional.assinaturaUrl} style={styles.assinaturaImg} />
              <Text style={styles.assinaturaNome}>{profissional.nome}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

function SecaoCrianca({
  a,
  crianca,
}: {
  a: AnthropometricAssessment;
  crianca: NonNullable<AntropometriaPdfViewModel["crianca"]>;
}) {
  const r = crianca.resultados;
  const g = crianca.gordura;
  return (
    <>
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>
          Crescimento (OMS){r ? ` — ${formatarIdadeMeses(r.meses)}` : ""}
        </Text>
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
        {r && <Text style={styles.nota}>Curvas: OMS 2006 (0–5 anos) e 2007 (5–19 anos).</Text>}
      </View>
      {g?.ok && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Composição corporal</Text>
          <Linha rotulo={`% de gordura (${g.dobras})`} valor={num(g.percentualGordura, 1, "%")} c={g.classificacao} />
          <Text style={styles.nota}>Fonte: {g.fonte}.</Text>
        </View>
      )}
      <Grade
        titulo="Dobras cutâneas (mm)"
        itens={[
          ["Tricipital", a.dobra_triceps_mm],
          ["Subescapular", a.dobra_subescapular_mm],
          ["Panturrilha", a.dobra_panturrilha_mm],
        ]}
      />
    </>
  );
}
