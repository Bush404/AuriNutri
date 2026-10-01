import { Circle, Document, G, Image, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import type { Comparacao, LinhaComparacao } from "@/lib/evolution";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";

/**
 * PDF "Evolução" (Fase 15, Bloco D — formato pedido pela nutricionista em
 * 30/09/2026, a partir do WebDiet): até 5 avaliações lado a lado, com o
 * gráfico de composição corporal e as tabelas de análises e medidas, cada
 * valor com a variação em relação à data anterior.
 */

export interface EvolucaoPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  geradoEm: string;
  comparacao: Comparacao;
}

const COR_PESO = "#5f6f68";
const COR_GORDURA = "#f2d16b";
const COR_LIVRE = "#e8938f";
const W = 500;
const H = 150;

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 80, fontSize: 9, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  logo: { width: 56, height: 56, objectFit: "contain" },
  profissionalNome: { fontSize: 12, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 8.5, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 15, fontWeight: 700, textAlign: "center", marginTop: 4 },
  paciente: { fontSize: 10, textAlign: "center", marginTop: 2, marginBottom: 6 },
  datas: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", marginBottom: 12 },
  dataChip: { fontSize: 8, color: "#ffffff", backgroundColor: "#1f7a5c", paddingVertical: 2, paddingHorizontal: 6, marginHorizontal: 2, borderRadius: 2 },
  faixa: { fontSize: 11, fontWeight: 700, textAlign: "center", backgroundColor: "#eef2f0", paddingVertical: 5, marginBottom: 6, marginTop: 6 },
  legenda: { flexDirection: "row", justifyContent: "center", marginBottom: 4 },
  legendaItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 6 },
  legendaCor: { width: 14, height: 6, marginRight: 3 },
  legendaTexto: { fontSize: 7.5, color: "#33413b" },
  eixo: { flexDirection: "row", width: W, marginBottom: 6 },
  eixoData: { flex: 1, fontSize: 7.5, textAlign: "center", color: "#5f6f68" },
  nota: { fontSize: 8, color: "#33413b", marginBottom: 8 },
  tabela: { borderWidth: 0.5, borderTopWidth: 0, borderColor: "#cfd8d4", marginBottom: 8 },
  tabelaTopo: { borderWidth: 0.5, borderColor: "#cfd8d4" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2eae6" },
  th: { fontSize: 8, fontWeight: 700, paddingVertical: 4, paddingHorizontal: 3, textAlign: "center", backgroundColor: "#f5f8f6" },
  tdLabel: { width: 150, fontSize: 8, paddingVertical: 3, paddingHorizontal: 4, fontWeight: 700 },
  td: { flex: 1, fontSize: 8, paddingVertical: 3, paddingHorizontal: 2, textAlign: "center" },
  delta: { fontSize: 6.5, color: "#5f6f68" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 6 },
  footerAssinatura: { alignItems: "center" },
  assinaturaImg: { width: 90, height: 32, objectFit: "contain" },
  assinaturaNome: { fontSize: 7.5, color: "#5f6f68", marginTop: 2 },
});

const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Barras empilhadas (gordura embaixo, massa livre em cima) + linha do peso total. */
function GraficoComposicao({ comparacao }: { comparacao: Comparacao }) {
  const n = comparacao.colunas.length;
  const larg = W / n;
  const maximo = Math.max(...comparacao.composicao.map((p) => p.pesoKg)) * 1.1 || 1;
  const y = (kg: number) => H - (kg / maximo) * (H - 8);
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => maximo * f);
  const pontosPeso = comparacao.colunas.flatMap((col, i) => {
    const p = comparacao.composicao.find((c) => c.data === col.data);
    return p ? [[larg * i + larg / 2, y(p.pesoKg)] as const] : [];
  });

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {ticks.map((t) => (
        <Line key={t} x1={0} y1={y(t)} x2={W} y2={y(t)} stroke="#e2eae6" strokeWidth={0.5} />
      ))}
      <Line x1={0} y1={H} x2={W} y2={H} stroke="#cfd8d4" strokeWidth={1} />
      {comparacao.colunas.map((col, i) => {
        const p = comparacao.composicao.find((c) => c.data === col.data);
        if (!p || p.massaGordaKg === null || p.massaLivreGorduraKg === null) return null;
        const x = larg * i + larg * 0.3;
        const w = larg * 0.4;
        return (
          <G key={col.chave}>
            <Rect x={x} y={y(p.massaGordaKg)} width={w} height={H - y(p.massaGordaKg)} fill={COR_GORDURA} />
            <Rect
              x={x}
              y={y(p.massaGordaKg + p.massaLivreGorduraKg)}
              width={w}
              height={y(p.massaGordaKg) - y(p.massaGordaKg + p.massaLivreGorduraKg)}
              fill={COR_LIVRE}
            />
          </G>
        );
      })}
      {pontosPeso.length > 1 && (
        <Polyline points={pontosPeso.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(" ")} stroke={COR_PESO} strokeWidth={2} fill="none" />
      )}
      {pontosPeso.map(([x, yy]) => (
        <Circle key={x} cx={x} cy={yy} r={3} fill={COR_PESO} />
      ))}
    </Svg>
  );
}

function Tabela({ titulo, linhas, comparacao }: { titulo: string; linhas: LinhaComparacao[]; comparacao: Comparacao }) {
  if (linhas.length === 0) return null;
  return (
    <View>
      {/* Título + cabeçalho nunca ficam sozinhos no pé da página. */}
      <View wrap={false} minPresenceAhead={60}>
        <Text style={styles.faixa}>{titulo}</Text>
        <View style={[styles.tr, styles.tabelaTopo]}>
          <Text style={[styles.th, { width: 150 }]}>Parâmetro</Text>
          {comparacao.colunas.map((c) => (
            <Text key={c.chave} style={[styles.th, { flex: 1 }]}>
              {formatDate(c.data)}
              {c.origem === "anexo" ? "*" : ""}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.tabela}>
        {linhas.map((l) => (
          <View key={l.label} style={styles.tr} wrap={false}>
            <Text style={styles.tdLabel}>{l.label}</Text>
            {l.valores.map((v, i) => (
              <Text key={i} style={styles.td}>
                {v}
                {l.deltas[i] !== null && l.deltas[i] !== 0 && (
                  <Text style={styles.delta}>
                    {" "}
                    ({l.deltas[i]! > 0 ? "+" : ""}
                    {fmt(l.deltas[i]!, l.casas)})
                  </Text>
                )}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function EvolucaoPdfDocument({ data }: { data: EvolucaoPdfViewModel }) {
  const { profissional, comparacao } = data;
  const temComposicao = comparacao.composicao.some((p) => p.massaGordaKg !== null);
  const temAnexo = comparacao.colunas.some((c) => c.origem === "anexo");

  return (
    <Document title={`Evolução - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
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
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), sem prop alt. */}
          {profissional.logoUrl && <Image src={profissional.logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.titulo}>Evolução antropométrica</Text>
        <Text style={styles.paciente}>Nome: {data.pacienteNome}</Text>
        <View style={styles.datas}>
          {comparacao.colunas.map((c) => (
            <Text key={c.chave} style={styles.dataChip}>
              {formatDate(c.data)}
            </Text>
          ))}
        </View>

        <Text style={styles.faixa}>Gráfico de evolução da composição corporal</Text>
        <View style={styles.legenda}>
          {[
            [COR_PESO, "Massa corporal total"],
            [COR_GORDURA, "Massa de gordura"],
            [COR_LIVRE, "Massa livre de gordura"],
          ].map(([cor, label]) => (
            <View key={label} style={styles.legendaItem}>
              <View style={[styles.legendaCor, { backgroundColor: cor }]} />
              <Text style={styles.legendaTexto}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={{ alignItems: "center" }}>
          <GraficoComposicao comparacao={comparacao} />
          <View style={styles.eixo}>
            {comparacao.colunas.map((c) => (
              <Text key={c.chave} style={styles.eixoData}>
                {formatDate(c.data)}
              </Text>
            ))}
          </View>
        </View>
        <Text style={styles.nota}>
          {temComposicao
            ? "A massa livre de gordura é tudo o que não é gordura: músculos, ossos, órgãos e água. Ela ajuda a ver se a mudança de peso veio da gordura ou da massa magra."
            : "Barras de gordura e massa livre de gordura aparecem quando a avaliação tem o % de gordura (protocolo de dobras, bioimpedância ou relatório)."}
        </Text>

        <Tabela titulo="Análises básicas" linhas={comparacao.analises} comparacao={comparacao} />
        <Tabela titulo="Medidas antropométricas" linhas={comparacao.medidas} comparacao={comparacao} />
        {temAnexo && <Text style={styles.delta}>* Relatório externo anexado.</Text>}

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
