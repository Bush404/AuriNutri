import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import { FONTE_LABELS } from "@/lib/nutrition";
import type { PlanPdfViewModel } from "@/lib/pdf/plan-pdf-data";

/**
 * Componente puramente visual — recebe o PlanPdfViewModel já pronto (todo o
 * cálculo já foi feito em plan-pdf-data.ts, reaproveitando lib/nutrition.ts)
 * e só desenha. Nenhuma conta acontece aqui.
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#16211c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 64, height: 64, objectFit: "contain" },
  profissionalNome: { fontSize: 14, fontWeight: 700 },
  profissionalDetalhe: { fontSize: 9, color: "#5f6f68", marginTop: 2 },
  planoTitulo: { fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  pacienteInfo: { fontSize: 10, color: "#33413b", marginBottom: 16 },
  mealCard: { marginBottom: 14, borderWidth: 1, borderColor: "#e2eae6", borderRadius: 4, padding: 10 },
  mealHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  mealNome: { fontSize: 12, fontWeight: 700 },
  mealHorario: { fontSize: 9, color: "#5f6f68" },
  mealObservacoes: { fontSize: 9, color: "#5f6f68", marginBottom: 6, fontStyle: "italic" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2eae6", paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  colAlimento: { flex: 3 },
  colQtd: { flex: 1, textAlign: "right" },
  colMacro: { flex: 1, textAlign: "right" },
  tableHeaderText: { fontSize: 8, color: "#5f6f68", textTransform: "uppercase" },
  mealTotalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#e2eae6" },
  mealTotalText: { fontSize: 9, fontWeight: 700 },
  totaisSection: { marginTop: 8, marginBottom: 16, padding: 12, backgroundColor: "#eaf5f0", borderRadius: 4 },
  totaisTitulo: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  totaisGrid: { flexDirection: "row", justifyContent: "space-between" },
  totalItem: { alignItems: "flex-start" },
  totalLabel: { fontSize: 8, color: "#5f6f68", textTransform: "uppercase" },
  totalValor: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  totalMeta: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
  comparativoOk: { fontSize: 8, color: "#124532", marginTop: 2 },
  comparativoAviso: { fontSize: 8, color: "#a35a15", marginTop: 2 },
  observacoesPlano: { marginBottom: 16, fontSize: 9, color: "#33413b" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: "#e2eae6", paddingTop: 8 },
  footerFonte: { fontSize: 7, color: "#5f6f68", textAlign: "center" },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
});

function TotalComparativo({
  label,
  valor,
  unidade,
  decimais,
  meta,
  comparativo,
}: {
  label: string;
  valor: number;
  unidade: string;
  decimais: number;
  meta: number | null;
  comparativo: { label: string; tone: "success" | "warning"; detail: string } | null;
}) {
  return (
    <View style={styles.totalItem}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValor}>
        {valor.toFixed(decimais)} {unidade}
      </Text>
      {meta !== null && (
        <Text style={styles.totalMeta}>
          Meta: {meta.toFixed(decimais)} {unidade}
        </Text>
      )}
      {comparativo && (
        <Text style={comparativo.tone === "success" ? styles.comparativoOk : styles.comparativoAviso}>
          {comparativo.label} ({comparativo.detail})
        </Text>
      )}
    </View>
  );
}

export function PlanPdfDocument({ data }: { data: PlanPdfViewModel }) {
  const { profissional } = data;

  return (
    <Document
      title={`Plano alimentar - ${data.pacienteNome}`}
      author={profissional.nome}
      creator="AuriNutri"
    >
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
            {profissional.especialidade && (
              <Text style={styles.profissionalDetalhe}>{profissional.especialidade}</Text>
            )}
            {profissional.telefone && <Text style={styles.profissionalDetalhe}>{profissional.telefone}</Text>}
            {profissional.endereco && <Text style={styles.profissionalDetalhe}>{profissional.endereco}</Text>}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), não <img> do DOM; não tem prop alt. */}
          {profissional.logoUrl && <Image src={profissional.logoUrl} style={styles.logo} />}
        </View>

        <Text style={styles.planoTitulo}>{data.plano.nome}</Text>
        <Text style={styles.pacienteInfo}>
          Paciente: {data.pacienteNome} · Início em {formatDate(data.plano.dataInicio)} · Gerado em{" "}
          {formatDate(data.geradoEm.slice(0, 10))}
        </Text>

        {data.plano.observacoes && (
          <View style={styles.observacoesPlano}>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>Observações do plano</Text>
            <Text>{data.plano.observacoes}</Text>
          </View>
        )}

        {data.refeicoes.map((meal) => (
          <View key={meal.id} style={styles.mealCard} wrap={false}>
            <View style={styles.mealHeaderRow}>
              <Text style={styles.mealNome}>{meal.nome}</Text>
              {meal.horario && <Text style={styles.mealHorario}>{meal.horario.slice(0, 5)}</Text>}
            </View>
            {meal.observacoes && <Text style={styles.mealObservacoes}>{meal.observacoes}</Text>}

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, styles.colAlimento]}>Alimento</Text>
              <Text style={[styles.tableHeaderText, styles.colQtd]}>Qtd.</Text>
              <Text style={[styles.tableHeaderText, styles.colMacro]}>Kcal</Text>
              <Text style={[styles.tableHeaderText, styles.colMacro]}>Prot.</Text>
              <Text style={[styles.tableHeaderText, styles.colMacro]}>Carb.</Text>
              <Text style={[styles.tableHeaderText, styles.colMacro]}>Gord.</Text>
            </View>

            {meal.itens.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.colAlimento}>
                  {item.nomeAlimento} ({FONTE_LABELS[item.fonteAlimento]})
                </Text>
                <Text style={styles.colQtd}>{item.quantidadeG}g</Text>
                <Text style={styles.colMacro}>{item.macros.calorias.toFixed(0)}</Text>
                <Text style={styles.colMacro}>{item.macros.proteinas.toFixed(1)}</Text>
                <Text style={styles.colMacro}>{item.macros.carboidratos.toFixed(1)}</Text>
                <Text style={styles.colMacro}>{item.macros.gorduras.toFixed(1)}</Text>
              </View>
            ))}

            <View style={styles.mealTotalRow}>
              <Text style={styles.mealTotalText}>Total: {meal.totais.calorias.toFixed(0)} kcal</Text>
              <Text style={styles.mealTotalText}>P {meal.totais.proteinas.toFixed(1)}g</Text>
              <Text style={styles.mealTotalText}>C {meal.totais.carboidratos.toFixed(1)}g</Text>
              <Text style={styles.mealTotalText}>G {meal.totais.gorduras.toFixed(1)}g</Text>
            </View>
          </View>
        ))}

        <View style={styles.totaisSection}>
          <Text style={styles.totaisTitulo}>Total diário do plano</Text>
          <View style={styles.totaisGrid}>
            <TotalComparativo
              label="Calorias"
              valor={data.totais.calorias}
              unidade="kcal"
              decimais={0}
              meta={data.metas.meta_kcal}
              comparativo={data.comparativos.calorias}
            />
            <TotalComparativo
              label="Proteínas"
              valor={data.totais.proteinas}
              unidade="g"
              decimais={1}
              meta={data.metas.meta_proteinas_g}
              comparativo={data.comparativos.proteinas}
            />
            <TotalComparativo
              label="Carboidratos"
              valor={data.totais.carboidratos}
              unidade="g"
              decimais={1}
              meta={data.metas.meta_carboidratos_g}
              comparativo={data.comparativos.carboidratos}
            />
            <TotalComparativo
              label="Gorduras"
              valor={data.totais.gorduras}
              unidade="g"
              decimais={1}
              meta={data.metas.meta_gorduras_g}
              comparativo={data.comparativos.gorduras}
            />
            <TotalComparativo
              label="Fibras"
              valor={data.totais.fibras}
              unidade="g"
              decimais={1}
              meta={null}
              comparativo={null}
            />
          </View>
        </View>

        <View style={styles.footer} fixed>
          {data.fonteFooter && <Text style={styles.footerFonte}>{data.fonteFooter}</Text>}
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
