import { Circle, Document, Image, Line, Page, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import { INDICADOR_EVOLUCAO_INFO, type IndicadorEvolucao, type PontoEvolucao } from "@/lib/evolution";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";

/**
 * PDF "Evolução física" (Fase 15, Bloco D): até 5 indicadores escolhidos,
 * com todas as avaliações e relatórios anexados até a data escolhida. O
 * gráfico usa só linhas e pontos (SVG do react-pdf); os valores vão em
 * texto embaixo de cada gráfico.
 */

export interface EvolucaoPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  ate: string;
  geradoEm: string;
  indicadores: { id: IndicadorEvolucao; pontos: PontoEvolucao[] }[];
}

const COR = "#1f7a5c";
const W = 500;
const H = 110;

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 90, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 16, fontWeight: 700, marginTop: 4, marginBottom: 4 },
  pacienteInfo: { fontSize: 10, color: "#33413b", marginBottom: 12 },
  bloco: { marginBottom: 14, padding: 8, borderWidth: 1, borderColor: "#e2eae6", borderRadius: 4 },
  blocoTopo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  blocoTitulo: { fontSize: 11, fontWeight: 700 },
  blocoResumo: { fontSize: 9, color: "#33413b" },
  valores: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  valor: { fontSize: 8, color: "#33413b", marginRight: 10, marginBottom: 2 },
  vazio: { fontSize: 9, color: "#5f6f68" },
  nota: { fontSize: 7.5, color: "#5f6f68" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Grafico({ pontos }: { pontos: PontoEvolucao[] }) {
  const P = 10;
  const tempos = pontos.map((p) => Date.parse(p.data));
  const t0 = Math.min(...tempos);
  const t1 = Math.max(...tempos);
  const vs = pontos.map((p) => p.valor);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const faixa = max - min || Math.abs(max) * 0.1 || 1;
  const x = (t: number) => (t1 === t0 ? W / 2 : P + ((t - t0) / (t1 - t0)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - (min - faixa * 0.1)) / (faixa * 1.2)) * (H - 2 * P);
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#e2eae6" strokeWidth={1} />
      {pontos.length > 1 && (
        <Polyline
          points={pontos.map((p, i) => `${x(tempos[i]).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ")}
          stroke={COR}
          strokeWidth={2}
          fill="none"
        />
      )}
      {pontos.map((p, i) => (
        <Circle
          key={`${p.data}-${i}`}
          cx={x(tempos[i])}
          cy={y(p.valor)}
          r={3}
          fill={p.origem === "anexo" ? "#ffffff" : COR}
          stroke={COR}
          strokeWidth={1.5}
        />
      ))}
    </Svg>
  );
}

export function EvolucaoPdfDocument({ data }: { data: EvolucaoPdfViewModel }) {
  const { profissional } = data;
  const temAnexo = data.indicadores.some((i) => i.pontos.some((p) => p.origem === "anexo"));

  return (
    <Document title={`Evolução física - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
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

        <Text style={styles.titulo}>Evolução física</Text>
        <Text style={styles.pacienteInfo}>
          Paciente: {data.pacienteNome} · Avaliações até {formatDate(data.ate)} · Gerado em {formatDate(data.geradoEm.slice(0, 10))}
        </Text>

        {data.indicadores.map(({ id, pontos }) => {
          const info = INDICADOR_EVOLUCAO_INFO[id];
          const unidade = info.unidade ? ` ${info.unidade}` : "";
          const primeiro = pontos[0];
          const ultimo = pontos[pontos.length - 1];
          return (
            <View key={id} style={styles.bloco} wrap={false}>
              <View style={styles.blocoTopo}>
                <Text style={styles.blocoTitulo}>{info.label}</Text>
                {ultimo && (
                  <Text style={styles.blocoResumo}>
                    Atual: {fmt(ultimo.valor, info.casas)}
                    {unidade}
                    {pontos.length > 1
                      ? ` (${ultimo.valor - primeiro.valor > 0 ? "+" : ""}${fmt(ultimo.valor - primeiro.valor, info.casas)} desde ${formatDate(primeiro.data)})`
                      : ""}
                  </Text>
                )}
              </View>
              {pontos.length === 0 ? (
                <Text style={styles.vazio}>Sem medidas até esta data.</Text>
              ) : (
                <>
                  <Grafico pontos={pontos} />
                  <View style={styles.valores}>
                    {pontos.map((p, i) => (
                      <Text key={`${p.data}-${i}`} style={styles.valor}>
                        {formatDate(p.data)}: {fmt(p.valor, info.casas)}
                        {unidade}
                        {p.origem === "anexo" ? " (relatório)" : ""}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>
          );
        })}

        {temAnexo && <Text style={styles.nota}>Ponto vazado = valor de um relatório externo anexado.</Text>}

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
