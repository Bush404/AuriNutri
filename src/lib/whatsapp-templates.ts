/**
 * Modelos de mensagem da Central de Envio (Fase 8, Bloco B — substituto do
 * portal do paciente). Centralizados aqui, não espalhados pelos
 * componentes, pra manter um tom só e facilitar ajustar o texto no futuro
 * sem caçar em vários arquivos. Tom humano, de quem manda mensagem pra um
 * paciente de verdade — nunca um aviso corporativo. O profissional sempre
 * pode editar antes de enviar; isto aqui é só o ponto de partida.
 */

/** Primeiro nome a partir do nome completo — usado em toda mensagem pra soar pessoal. */
export function primeiroNomeDe(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || nomeCompleto;
}

export function buildPlanoWhatsAppMessage(input: {
  primeiroNome: string;
  nomeProfissional: string;
  nomePlano: string;
  link: string;
}): string {
  return `Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}. Segue o seu plano alimentar "${input.nomePlano}": ${input.link}\n\nQualquer dúvida sobre alguma refeição, me chama por aqui.`;
}

export interface ReceitaParaMensagem {
  nome: string;
  modoPreparo: string | null;
  rendimentoG: number | null;
  numeroPorcoes: number | null;
  ingredientes: { nome: string; quantidadeG: number }[];
}

export function buildReceitaWhatsAppMessage(input: {
  primeiroNome: string;
  nomeProfissional: string;
  receita: ReceitaParaMensagem;
}): string {
  const { primeiroNome, nomeProfissional, receita } = input;

  const linhasIngredientes = receita.ingredientes
    .map((i) => `• ${i.nome} — ${i.quantidadeG}g`)
    .join("\n");

  const porcoes = receita.numeroPorcoes ? `Rende ${receita.numeroPorcoes} porção(ões).` : "";

  const partes = [
    `Oi, ${primeiroNome}! Aqui é ${nomeProfissional}. Separei a receita de "${receita.nome}" pra você:`,
    linhasIngredientes ? `\n*Ingredientes:*\n${linhasIngredientes}` : "",
    porcoes ? `\n${porcoes}` : "",
    receita.modoPreparo ? `\n*Modo de preparo:*\n${receita.modoPreparo}` : "",
    "\nBom apetite! Qualquer dúvida no preparo, me chama.",
  ];

  return partes.filter(Boolean).join("\n").trim();
}

export function buildConsultaLembreteWhatsAppMessage(input: {
  primeiroNome: string;
  nomeProfissional: string;
  dataFormatada: string;
  horaFormatada: string;
}): string {
  return `Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}, passando pra lembrar da nossa consulta em ${input.dataFormatada} às ${input.horaFormatada}. Te espero!`;
}

export function buildMensagemLivreWhatsAppTemplate(input: {
  primeiroNome: string;
  nomeProfissional: string;
}): string {
  return `Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}.`;
}
