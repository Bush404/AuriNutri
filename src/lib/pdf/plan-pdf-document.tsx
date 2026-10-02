import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";
import { FONTE_LABELS } from "@/lib/nutrition";
import type { PlanPdfViewModel } from "@/lib/pdf/plan-pdf-data";
import type { Situacao } from "@/lib/dri";

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
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2eae6",
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  colAlimento: { flex: 3 },
  substituicoes: { fontSize: 8, color: "#5f6f68", paddingLeft: 8, marginBottom: 3 },
  colQtd: { flex: 1.8, textAlign: "right" },
  colMacro: { flex: 1, textAlign: "right" },
  tableHeaderText: { fontSize: 8, color: "#5f6f68", textTransform: "uppercase" },
  mealTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e2eae6",
  },
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
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: "#e2eae6",
    paddingTop: 8,
  },
  footerFonte: { fontSize: 7, color: "#5f6f68", textAlign: "center" },
  footerAssinatura: { alignItems: "center", marginTop: 8 },
  assinaturaImg: { width: 100, height: 36, objectFit: "contain" },
  assinaturaNome: { fontSize: 8, color: "#5f6f68", marginTop: 2 },
  secaoTitulo: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  secaoSubtitulo: { fontSize: 9, color: "#5f6f68", marginBottom: 10 },
  colNutriente: { flex: 2.6 },
  colNumero: { flex: 1.2, textAlign: "right" },
  colSituacao: { flex: 1.4, textAlign: "right" },
  nota: { fontSize: 8, color: "#5f6f68", marginTop: 6 },
  grupoCompras: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  linhaCompras: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2eae6",
  },
  situacaoAbaixo: { color: "#a35a15" },
  situacaoAcima: { color: "#a35a15" },
  situacaoOk: { color: "#124532" },
});

const fmt = (v: number, casas: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const casasDe = (v: number) => (v >= 100 ? 0 : v >= 10 ? 1 : 2);

const ROTULO_SITUACAO: Record<Situacao, string> = {
  abaixo: "Abaixo",
  adequado: "Adequado",
  acima: "Acima",
  so_limite: "—",
  sem_dado: "Sem dado",
};

function Rodape({ data }: { data: PlanPdfViewModel }) {
  const { profissional } = data;
  return (
    <View style={styles.footer} fixed>
      {data.fonteFooter && <Text style={styles.footerFonte}>{data.fonteFooter}</Text>}
      {profissional.assinaturaUrl && (
        <View style={styles.footerAssinatura}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é o componente do @react-pdf/renderer (PDF), não <img> do DOM; não tem prop alt. */}
          <Image src={profissional.assinaturaUrl} style={styles.assinaturaImg} />
          <Text style={styles.assinaturaNome}>{profissional.nome}</Text>
        </View>
      )}
    </View>
  );
}

/** Página "Relatório de nutrientes": macros por refeição + micronutrientes × DRI (Fase 17, Bloco F). */
function PaginaNutrientes({ data }: { data: PlanPdfViewModel }) {
  const n = data.nutrientes;
  if (!n) return null;
  return (
    <Page size="A4" style={[styles.page, { paddingBottom: 90 }]} wrap>
      <Text style={styles.secaoTitulo}>Relatório de nutrientes</Text>
      <Text style={styles.secaoSubtitulo}>
        {data.pacienteNome}
        {n.faixa ? ` · Referência: ${n.faixa}` : ""}
      </Text>

      <Text style={styles.grupoCompras}>Por refeição</Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderText, styles.colNutriente]}>Refeição</Text>
        <Text style={[styles.tableHeaderText, styles.colNumero]}>Kcal</Text>
        <Text style={[styles.tableHeaderText, styles.colNumero]}>Prot. (g)</Text>
        <Text style={[styles.tableHeaderText, styles.colNumero]}>Carb. (g)</Text>
        <Text style={[styles.tableHeaderText, styles.colNumero]}>Gord. (g)</Text>
        <Text style={[styles.tableHeaderText, styles.colNumero]}>Fibras (g)</Text>
      </View>
      {[
        ...data.refeicoes.map((m) => ({ id: m.id, nome: m.nome, t: m.totais })),
        { id: "total", nome: "Total do dia", t: data.totais },
      ].map((r) => (
        <View key={r.id} style={styles.tableRow}>
          <Text style={[styles.colNutriente, r.id === "total" ? { fontWeight: 700 } : {}]}>{r.nome}</Text>
          <Text style={styles.colNumero}>{fmt(r.t.calorias, 0)}</Text>
          <Text style={styles.colNumero}>{fmt(r.t.proteinas, 1)}</Text>
          <Text style={styles.colNumero}>{fmt(r.t.carboidratos, 1)}</Text>
          <Text style={styles.colNumero}>{fmt(r.t.gorduras, 1)}</Text>
          <Text style={styles.colNumero}>{fmt(r.t.fibras, 1)}</Text>
        </View>
      ))}

      <Text style={styles.grupoCompras}>Micronutrientes × recomendação diária (DRI)</Text>
      {n.linhas.length === 0 ? (
        <Text style={styles.nota}>
          Cadastre o sexo e a data de nascimento do paciente para comparar com a recomendação da faixa de idade.
        </Text>
      ) : (
        <>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, styles.colNutriente]}>Nutriente</Text>
            <Text style={[styles.tableHeaderText, styles.colNumero]}>No cardápio</Text>
            <Text style={[styles.tableHeaderText, styles.colNumero]}>Recomendação</Text>
            <Text style={[styles.tableHeaderText, styles.colNumero]}>% da rec.</Text>
            <Text style={[styles.tableHeaderText, styles.colNumero]}>Limite (UL)</Text>
            <Text style={[styles.tableHeaderText, styles.colSituacao]}>Situação</Text>
          </View>
          {n.linhas.map((l) => (
            <View key={l.chave} style={styles.tableRow} wrap={false}>
              <Text style={styles.colNutriente}>
                {l.rotulo} ({l.unidade})
              </Text>
              <Text style={styles.colNumero}>
                {l.consumo === null ? "—" : fmt(l.consumo, casasDe(l.consumo))}
                {l.consumo !== null && l.itensSemDado > 0 ? "*" : ""}
              </Text>
              <Text style={styles.colNumero}>
                {l.recomendacao === null ? "—" : `${fmt(l.recomendacao, casasDe(l.recomendacao))} ${l.tipo}`}
              </Text>
              <Text style={styles.colNumero}>{l.percentual === null ? "—" : `${fmt(l.percentual, 0)}%`}</Text>
              <Text style={styles.colNumero}>
                {l.limite === null ? "—" : fmt(l.limite, casasDe(l.limite))}
                {l.chave === "sodio_mg" && l.limite !== null ? " CDRR" : ""}
              </Text>
              <Text
                style={[
                  styles.colSituacao,
                  l.acimaDoLimite || l.situacao === "abaixo" || l.situacao === "acima"
                    ? styles.situacaoAbaixo
                    : l.situacao === "adequado"
                      ? styles.situacaoOk
                      : {},
                ]}
              >
                {l.acimaDoLimite ? "Acima do limite" : ROTULO_SITUACAO[l.situacao]}
              </Text>
            </View>
          ))}
        </>
      )}
      <View style={[styles.tableRow, { marginTop: 6 }]}>
        <Text style={styles.nota}>
          Sem DRI:{" "}
          {n.semReferencia
            .map((s) => `${s.rotulo} ${s.valor === null ? "—" : fmt(s.valor, casasDe(s.valor))} ${s.unidade}`)
            .join(" · ")}
        </Text>
      </View>
      <Text style={styles.nota}>
        Adequado = entre 80% e 120% da recomendação (RDA ou AI). Limite = UL; no sódio, a CDRR (“reduzir se acima de”).
        Fonte: National Academies, Dietary Reference Intakes Summary Tables (2019).
        {n.linhas.some((l) => l.itensSemDado > 0)
          ? " * Total parcial: algum alimento do cardápio não tem esse dado na tabela de origem."
          : ""}
        {n.itensSemMicros > 0
          ? ` ${n.itensSemMicros} alimento(s) do cardápio sem micronutrientes (alimentos próprios ou receitas adicionados antes de 02/10/2026).`
          : ""}
      </Text>
      <Rodape data={data} />
    </Page>
  );
}

/** Página "Lista de compras" (Fase 17, Bloco F). */
function PaginaCompras({ data }: { data: PlanPdfViewModel }) {
  const lista = data.listaDeCompras;
  if (!lista) return null;
  return (
    <Page size="A4" style={[styles.page, { paddingBottom: 90 }]} wrap>
      <Text style={styles.secaoTitulo}>Lista de compras</Text>
      <Text style={styles.secaoSubtitulo}>
        Para {data.opcoes.dias} {data.opcoes.dias === 1 ? "dia" : "dias"} do plano · {data.pacienteNome}. Quantidades do
        alimento como prescrito (ex.: arroz cozido); os substitutos não entram.
      </Text>
      {lista.length === 0 && <Text style={styles.nota}>O plano ainda não tem alimentos.</Text>}
      {lista.map((g) => (
        <View key={g.grupo} wrap={false}>
          <Text style={styles.grupoCompras}>{g.grupo}</Text>
          {g.itens.map((i) => (
            <View key={i.nome} style={styles.linhaCompras}>
              <Text>☐ {i.nome}</Text>
              <Text>{i.texto}</Text>
            </View>
          ))}
        </View>
      ))}
      <Rodape data={data} />
    </Page>
  );
}

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
  const tabela = data.opcoes.estilo === "tabela";

  return (
    <Document title={`Plano alimentar - ${data.pacienteNome}`} author={profissional.nome} creator="AuriNutri">
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

        {data.refeicoes.map((meal, indice) => (
          <View key={meal.id} style={styles.mealCard} wrap={false} break={data.opcoes.quebraPorRefeicao && indice > 0}>
            <View style={styles.mealHeaderRow}>
              <Text style={styles.mealNome}>{meal.nome}</Text>
              {meal.horario && <Text style={styles.mealHorario}>{meal.horario.slice(0, 5)}</Text>}
            </View>
            {meal.observacoes && <Text style={styles.mealObservacoes}>{meal.observacoes}</Text>}

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, styles.colAlimento]}>Alimento</Text>
              <Text style={[styles.tableHeaderText, styles.colQtd]}>Qtd.</Text>
              {tabela && (
                <>
                  <Text style={[styles.tableHeaderText, styles.colMacro]}>Kcal</Text>
                  <Text style={[styles.tableHeaderText, styles.colMacro]}>Prot.</Text>
                  <Text style={[styles.tableHeaderText, styles.colMacro]}>Carb.</Text>
                  <Text style={[styles.tableHeaderText, styles.colMacro]}>Gord.</Text>
                </>
              )}
            </View>

            {meal.itens.map((item, index) => (
              <View key={index} wrap={false}>
                <View style={styles.tableRow}>
                  <Text style={styles.colAlimento}>
                    {item.nomeAlimento} ({FONTE_LABELS[item.fonteAlimento]})
                  </Text>
                  <Text style={styles.colQtd}>{item.quantidadeTexto}</Text>
                  {tabela && (
                    <>
                      <Text style={styles.colMacro}>{item.macros.calorias.toFixed(0)}</Text>
                      <Text style={styles.colMacro}>{item.macros.proteinas.toFixed(1)}</Text>
                      <Text style={styles.colMacro}>{item.macros.carboidratos.toFixed(1)}</Text>
                      <Text style={styles.colMacro}>{item.macros.gorduras.toFixed(1)}</Text>
                    </>
                  )}
                </View>
                {item.substituicoes.length > 0 && (
                  <Text style={styles.substituicoes}>Opções de substituição: {item.substituicoes.join(" · ")}</Text>
                )}
              </View>
            ))}

            {tabela && (
              <View style={styles.mealTotalRow}>
                <Text style={styles.mealTotalText}>Total: {meal.totais.calorias.toFixed(0)} kcal</Text>
                <Text style={styles.mealTotalText}>P {meal.totais.proteinas.toFixed(1)}g</Text>
                <Text style={styles.mealTotalText}>C {meal.totais.carboidratos.toFixed(1)}g</Text>
                <Text style={styles.mealTotalText}>G {meal.totais.gorduras.toFixed(1)}g</Text>
              </View>
            )}
          </View>
        ))}

        {tabela && (
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
        )}

        <Rodape data={data} />
      </Page>
      <PaginaNutrientes data={data} />
      <PaginaCompras data={data} />
    </Document>
  );
}
