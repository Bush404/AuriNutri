import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import type { AnthropometricAssessment } from "@/lib/types/database.types";

/**
 * Uma linha por avaliação, em ordem cronológica — sem gráfico (react-pdf não
 * tem suporte razoável a canvas/svg de gráfico), mas cobre mais medidas do
 * que o gráfico de Evolução na tela mostra (que só plota peso/IMC).
 */

export interface AntropometriaPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  pacienteNome: string;
  geradoEm: string;
  assessments: AnthropometricAssessment[];
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  pacienteInfo: { fontSize: 10, color: "#33413b", marginBottom: 16 },
  resumoSection: { marginBottom: 16, padding: 12, backgroundColor: "#eaf5f0", borderRadius: 4 },
  resumoTitulo: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  resumoTexto: { fontSize: 9, color: "#33413b" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2eae6", paddingBottom: 4, marginBottom: 2 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f0f4f2" },
  tableHeaderText: { fontSize: 7.5, color: "#5f6f68", textTransform: "uppercase" },
  cell: { fontSize: 8.5 },
  colData: { flex: 1.3 },
  colNum: { flex: 1, textAlign: "right" },
  colObs: { flex: 1.6, wordBreak: "break-all" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

function numero(value: number | null, decimais = 1) {
  return value === null ? "—" : value.toFixed(decimais);
}

export function AntropometriaPdfDocument({ data }: { data: AntropometriaPdfViewModel }) {
  const { profissional } = data;
  const sorted = [...data.assessments].sort(
    (a, b) => new Date(a.data_avaliacao).getTime() - new Date(b.data_avaliacao).getTime()
  );
  const primeira = sorted[0] ?? null;
  const ultima = sorted[sorted.length - 1] ?? null;

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
          Paciente: {data.pacienteNome} · Gerado em {formatDate(data.geradoEm.slice(0, 10))}
        </Text>

        {primeira && ultima && primeira.id !== ultima.id && (
          <View style={styles.resumoSection}>
            <Text style={styles.resumoTitulo}>Resumo do período</Text>
            <Text style={styles.resumoTexto}>
              De {formatDate(primeira.data_avaliacao)} a {formatDate(ultima.data_avaliacao)}: peso de{" "}
              {numero(primeira.peso_kg)}kg para {numero(ultima.peso_kg)}kg ({ultima.peso_kg >= primeira.peso_kg ? "+" : ""}
              {(ultima.peso_kg - primeira.peso_kg).toFixed(1)}kg), IMC de {numero(primeira.imc)} para {numero(ultima.imc)}.
            </Text>
          </View>
        )}

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderText, styles.colData]}>Data</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Peso (kg)</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Altura (cm)</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>IMC</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Cintura</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Quadril</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Braço</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Coxa</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>Pescoço</Text>
          <Text style={[styles.tableHeaderText, styles.colNum]}>% Gord.</Text>
          <Text style={[styles.tableHeaderText, styles.colObs]}>Observações</Text>
        </View>

        {sorted.map((a) => (
          <View key={a.id} style={styles.tableRow} wrap={false}>
            <Text style={[styles.cell, styles.colData]}>{formatDate(a.data_avaliacao)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.peso_kg)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.altura_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.imc)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.circunferencia_cintura_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.circunferencia_quadril_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.circunferencia_braco_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.circunferencia_coxa_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.circunferencia_pescoco_cm)}</Text>
            <Text style={[styles.cell, styles.colNum]}>{numero(a.percentual_gordura)}</Text>
            <Text style={[styles.cell, styles.colObs]}>{a.observacoes ?? "—"}</Text>
          </View>
        ))}

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
