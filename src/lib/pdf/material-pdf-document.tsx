import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import { parseMaterialMarkdown, type MaterialMarkdownRun } from "@/lib/pdf/material-markdown";

interface MaterialPdfBase {
  profissional: ProfissionalPdfHeaderData;
  titulo: string;
  tipoLabel: string;
  descricao: string | null;
}

export type MaterialPdfViewModel =
  | (MaterialPdfBase & { kind: "texto"; secaoTitulo: string | null; secaoSubtitulo: string | null; conteudo: string })
  | (MaterialPdfBase & { kind: "imagem"; imageUrl: string });

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 18, fontWeight: 700, marginTop: 8, marginBottom: 2 },
  tipoLabel: { fontSize: 9, color: "#5f6f68", textTransform: "uppercase", marginBottom: 8 },
  descricao: { fontSize: 10, color: "#33413b", marginBottom: 12, fontStyle: "italic" },
  paragrafo: { fontSize: 10.5, lineHeight: 1.6, marginBottom: 8 },
  secaoSubtitulo: { fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginTop: 2, marginBottom: 10 },
  bold: { fontWeight: 700 },
  imagem: { width: "100%", marginTop: 4, objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

function Runs({ runs }: { runs: MaterialMarkdownRun[] }) {
  return (
    <>
      {runs.map((run, index) => (
        <Text key={index} style={run.bold ? styles.bold : undefined}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

/** PDF de um material da biblioteca para a Central de Envio — texto escrito no sistema ou imagem enviada (arquivo em PDF é servido direto, sem passar por aqui — ver generate-material-pdf.ts). */
export function MaterialPdfDocument({ data }: { data: MaterialPdfViewModel }) {
  const { profissional } = data;

  return (
    <Document title={`Material - ${data.titulo}`} author={profissional.nome} creator="AuriNutri">
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

        {data.kind === "texto" ? (
          <>
            {/* O nome do material (data.titulo) é só organização interna da biblioteca —
                nunca aparece no PDF que o paciente recebe. Quem ocupa o lugar visual do
                "título" aqui é secaoTitulo, escrito pelo profissional pra esse documento. */}
            {data.secaoTitulo && <Text style={styles.titulo}>{data.secaoTitulo}</Text>}
            {data.secaoSubtitulo && <Text style={styles.secaoSubtitulo}>{data.secaoSubtitulo}</Text>}
            {parseMaterialMarkdown(data.conteudo).map((paragrafo, index) => (
              <Text key={index} style={styles.paragrafo}>
                <Runs runs={paragrafo.runs} />
              </Text>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.titulo}>{data.titulo}</Text>
            <Text style={styles.tipoLabel}>{data.tipoLabel}</Text>
            {data.descricao && <Text style={styles.descricao}>{data.descricao}</Text>}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), sem prop alt. */}
            <Image src={data.imageUrl} style={styles.imagem} />
          </>
        )}

        <View style={styles.footer} fixed>
          {profissional.assinaturaUrl && (
            <View style={styles.footerAssinatura}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- ver comentário equivalente acima. */}
              <Image src={profissional.assinaturaUrl} style={styles.assinaturaImg} />
              <Text style={styles.assinaturaNome}>{profissional.nome}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
