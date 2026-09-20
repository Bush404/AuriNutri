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

export function buildEvolucaoFisicaWhatsAppMessage(input: {
  primeiroNome: string;
  nomeProfissional: string;
  link: string;
}): string {
  return `Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}. Segue o resumo da sua evolução física em PDF: ${input.link}\n\nQualquer dúvida, me chama por aqui.`;
}

/** Mensagem genérica pra qualquer item de "Impressos" (receita avulsa ou arquivo do computador) — o título já identifica o que é. */
export function buildImpressoWhatsAppMessage(input: {
  primeiroNome: string;
  nomeProfissional: string;
  titulo: string;
  link: string;
}): string {
  return `Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}. Segue "${input.titulo}" em PDF: ${input.link}`;
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
