import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReciboPdfViewModel } from "@/lib/pdf/recibo-pdf-data";

/**
 * Componente puramente visual — o cálculo/formatação já veio pronto de
 * recibo-pdf-data.ts (mesmo princípio de plan-pdf-document.tsx).
 *
 * VOCABULÁRIO: este documento é um "Recibo" — nunca usar "nota fiscal",
 * "NFS-e" ou "fatura" em nenhum texto aqui, e nunca adicionar uma numeração
 * sequencial (isso sugeriria um documento fiscal, que este não é).
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 20, fontWeight: 700, marginTop: 24, marginBottom: 24, textAlign: "center" },
  valorDestaque: { fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  valorExtenso: { fontSize: 10, color: "#5f6f68", textAlign: "center", marginBottom: 28, fontStyle: "italic" },
  corpoTexto: { fontSize: 11, lineHeight: 1.7, marginBottom: 24 },
  destaque: { fontWeight: 700 },
  metaInfo: { fontSize: 10, color: "#33413b", marginTop: 24 },
  assinaturaBloco: { alignItems: "center", marginTop: 64 },
  assinaturaImg: { width: 120, height: 44, objectFit: "contain", marginBottom: 4 },
  assinaturaLinha: { borderTopWidth: 1, borderTopColor: "#16211c", width: 240, paddingTop: 6, alignItems: "center" },
  assinaturaNome: { fontSize: 10, fontWeight: 700 },
  assinaturaDetalhe: { fontSize: 8.5, color: "#5f6f68", marginTop: 1 },
});

export function ReciboPdfDocument({ data }: { data: ReciboPdfViewModel }) {
  const { profissional } = data;

  return (
    <Document title={`Recibo - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
      <Page size="A4" style={styles.page}>
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
            {profissional.endereco && <Text style={styles.profissionalDetalhe}>{profissional.endereco}</Text>}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), não <img> do DOM; não tem prop alt. */}
          {profissional.logoUrl && <Image src={profissional.logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.titulo}>RECIBO</Text>

        <Text style={styles.valorDestaque}>{data.valorFormatado}</Text>
        <Text style={styles.valorExtenso}>({data.valorPorExtensoFormatado})</Text>

        <Text style={styles.corpoTexto}>
          Recebi de <Text style={styles.destaque}>{data.pacienteNome}</Text> a quantia de{" "}
          <Text style={styles.destaque}>
            {data.valorFormatado} ({data.valorPorExtensoFormatado})
          </Text>
          , referente a: <Text style={styles.destaque}>{data.descricao}</Text>.
        </Text>

        <Text style={styles.metaInfo}>Data do pagamento: {data.dataPagamentoFormatada}</Text>

        <View style={styles.assinaturaBloco}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- ver comentário equivalente acima, no logo. */}
          {profissional.assinaturaUrl && <Image src={profissional.assinaturaUrl} style={styles.assinaturaImg} />}
          <View style={styles.assinaturaLinha}>
            <Text style={styles.assinaturaNome}>{profissional.nome}</Text>
            {(profissional.crn || profissional.crnUf) && (
              <Text style={styles.assinaturaDetalhe}>
                CRN {profissional.crn}
                {profissional.crnUf ? `/${profissional.crnUf}` : ""}
              </Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
