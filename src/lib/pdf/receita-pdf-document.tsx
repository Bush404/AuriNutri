import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ProfissionalPdfHeaderData } from "@/lib/pdf/profissional-header";
import type { MacroTotals } from "@/lib/nutrition";

export interface ReceitaPdfViewModel {
  profissional: ProfissionalPdfHeaderData;
  nome: string;
  descricao: string | null;
  modoPreparo: string | null;
  rendimentoG: number;
  numeroPorcoes: number;
  tempoPreparoMin: number | null;
  ingredientes: { nome: string; quantidadeG: number }[];
  macrosPorPorcao: MacroTotals;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  titulo: { fontSize: 18, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  descricao: { fontSize: 10, color: "#33413b", marginBottom: 8, fontStyle: "italic" },
  metaInfo: { fontSize: 9, color: "#5f6f68", marginBottom: 16 },
  sectionTitulo: { fontSize: 12, fontWeight: 700, marginBottom: 6, marginTop: 4 },
  ingredienteRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#f0f4f2" },
  ingredienteNome: { fontSize: 9.5 },
  ingredienteQtd: { fontSize: 9.5, color: "#5f6f68" },
  modoPreparo: { fontSize: 9.5, marginTop: 4, lineHeight: 1.5 },
  totaisSection: { marginTop: 16, padding: 12, backgroundColor: "#eaf5f0", borderRadius: 4 },
  totaisTitulo: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
  totaisGrid: { flexDirection: "row", justifyContent: "space-between" },
  totalItem: { alignItems: "flex-start" },
  totalLabel: { fontSize: 8, color: "#5f6f68", textTransform: "uppercase" },
  totalValor: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

export function ReceitaPdfDocument({ data }: { data: ReceitaPdfViewModel }) {
  const { profissional } = data;

  return (
    <Document title={`Receita - ${data.nome}`} author={profissional.nome} creator="AuriNutri">
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

        <Text style={styles.titulo}>{data.nome}</Text>
        {data.descricao && <Text style={styles.descricao}>{data.descricao}</Text>}
        <Text style={styles.metaInfo}>
          Rende {data.numeroPorcoes} porção(ões) · {data.rendimentoG}g prontos
          {data.tempoPreparoMin !== null ? ` · ${data.tempoPreparoMin} min de preparo` : ""}
        </Text>

        <Text style={styles.sectionTitulo}>Ingredientes</Text>
        {data.ingredientes.map((ingrediente, index) => (
          <View key={index} style={styles.ingredienteRow}>
            <Text style={styles.ingredienteNome}>{ingrediente.nome}</Text>
            <Text style={styles.ingredienteQtd}>{ingrediente.quantidadeG}g</Text>
          </View>
        ))}

        {data.modoPreparo && (
          <>
            <Text style={styles.sectionTitulo}>Modo de preparo</Text>
            <Text style={styles.modoPreparo}>{data.modoPreparo}</Text>
          </>
        )}

        <View style={styles.totaisSection}>
          <Text style={styles.totaisTitulo}>Por porção</Text>
          <View style={styles.totaisGrid}>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Calorias</Text>
              <Text style={styles.totalValor}>{data.macrosPorPorcao.calorias.toFixed(0)} kcal</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Proteínas</Text>
              <Text style={styles.totalValor}>{data.macrosPorPorcao.proteinas.toFixed(1)} g</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Carboidratos</Text>
              <Text style={styles.totalValor}>{data.macrosPorPorcao.carboidratos.toFixed(1)} g</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Gorduras</Text>
              <Text style={styles.totalValor}>{data.macrosPorPorcao.gorduras.toFixed(1)} g</Text>
            </View>
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>Fibras</Text>
              <Text style={styles.totalValor}>{data.macrosPorPorcao.fibras.toFixed(1)} g</Text>
            </View>
          </View>
        </View>

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
