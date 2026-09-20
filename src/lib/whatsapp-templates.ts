/**
 * Modelo de mensagem da Central de Envio (Fase 8, Bloco B — substituto do
 * portal do paciente). Centralizado aqui, não espalhado pelos componentes,
 * pra manter um tom só e facilitar ajustar o texto no futuro sem caçar em
 * vários arquivos. Tom humano, de quem manda mensagem pra um paciente de
 * verdade — nunca um aviso corporativo. O profissional sempre pode editar
 * antes de enviar; isto aqui é só o ponto de partida.
 *
 * Uma ÚNICA mensagem combinada reúne tudo que foi marcado pra enviar (plano,
 * avaliação antropométrica, impressos, lembrete de consulta, mensagem
 * livre) — pedido explícito do usuário pra não precisar mandar uma
 * mensagem de WhatsApp por item.
 */

/** Primeiro nome a partir do nome completo — usado na saudação pra soar pessoal. */
export function primeiroNomeDe(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || nomeCompleto;
}

export interface MensagemCombinadaInput {
  primeiroNome: string;
  nomeProfissional: string;
  plano: { nome: string; link: string } | null;
  avaliacao: { dataFormatada: string; link: string } | null;
  impressos: { titulo: string; link: string }[];
  consulta: { dataFormatada: string; horaFormatada: string } | null;
  recibo: { descricao: string; link: string } | null;
  mensagemLivre: string;
}

/** Monta a mensagem única a partir de só as partes que já estão prontas (link gerado, item selecionado) — partes sem dado ficam de fora, nunca aparecem como placeholder vazio. */
export function buildMensagemCombinada(input: MensagemCombinadaInput): string {
  const partes: string[] = [`Oi, ${input.primeiroNome}! Aqui é ${input.nomeProfissional}.`];

  if (input.plano) {
    partes.push(`Segue o seu plano alimentar "${input.plano.nome}": ${input.plano.link}`);
  }

  if (input.avaliacao) {
    partes.push(`Segue sua avaliação antropométrica de ${input.avaliacao.dataFormatada}: ${input.avaliacao.link}`);
  }

  for (const impresso of input.impressos) {
    partes.push(`Segue "${impresso.titulo}": ${impresso.link}`);
  }

  if (input.consulta) {
    partes.push(`Lembrando da nossa consulta em ${input.consulta.dataFormatada} às ${input.consulta.horaFormatada}.`);
  }

  if (input.recibo) {
    partes.push(`Segue o recibo de "${input.recibo.descricao}": ${input.recibo.link}`);
  }

  if (input.mensagemLivre.trim()) {
    partes.push(input.mensagemLivre.trim());
  }

  return partes.join("\n\n");
}
