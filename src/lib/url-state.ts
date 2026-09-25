/**
 * Altera parâmetros da URL atual SEM ida ao servidor (History API nativa — o
 * Next.js sincroniza com useSearchParams). Usado para lembrar a aba aberta do
 * paciente e o registro aberto dentro dela: "voltar" (link ou navegador) cai
 * de volta no mesmo lugar.
 *
 * `push` cria uma entrada no histórico (o "voltar" do navegador desfaz);
 * `replace` só troca a atual (trocar de aba não enche o histórico).
 * `null` remove o parâmetro.
 */
export function updateSearchParams(changes: Record<string, string | null>, mode: "push" | "replace" = "replace") {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
