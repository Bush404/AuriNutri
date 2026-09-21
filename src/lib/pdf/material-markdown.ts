/**
 * Formatação leve do texto livre do material escrito da biblioteca. Título
 * e subtítulo de seção viraram campos próprios no formulário (ver
 * library-material-form-dialog.tsx) — não fazem mais parte da sintaxe daqui.
 * O texto livre suporta só `**negrito**`, que não exige aprender nenhuma
 * sintaxe de linha (# / -), pedido explícito do usuário por ser mais fácil
 * de aprender pra quem não é técnico.
 */

export interface MaterialMarkdownRun {
  text: string;
  bold: boolean;
}

export interface MaterialMarkdownParagraph {
  runs: MaterialMarkdownRun[];
}

/** "texto **em negrito** aqui" -> [{text:"texto ",bold:false},{text:"em negrito",bold:true},{text:" aqui",bold:false}] */
function splitBoldRuns(text: string): MaterialMarkdownRun[] {
  const runs: MaterialMarkdownRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false });
  }

  return runs.length > 0 ? runs : [{ text, bold: false }];
}

/** Quebra o texto livre em parágrafos (linhas em branco separam) e resolve o negrito de cada um. */
export function parseMaterialMarkdown(conteudo: string): MaterialMarkdownParagraph[] {
  return conteudo
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ runs: splitBoldRuns(line) }));
}
