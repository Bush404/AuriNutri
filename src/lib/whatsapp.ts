/**
 * Normaliza um telefone brasileiro pro formato exigido pelo wa.me (DDI +
 * DDD + número, só dígitos, ex. "5511999999999"). Retorna `null` quando o
 * número não tem cara de válido — em vez de gerar um link quebrado, quem
 * chama deve tratar `null` escondendo o botão de enviar (ver
 * PatientSendPanel).
 *
 * Heurística (não é validação de operadora): aceita DDD 11–99, número local
 * de 8 dígitos (fixo) ou 9 dígitos (celular, precisa começar com 9), com ou
 * sem o "55" já incluso.
 */
export function normalizePhoneToWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;

  let digits = telefone.replace(/\D/g, "");
  if (!digits) return null;

  // Se já vem com o DDI 55 (tamanho de DDI+DDD+número), tira pra validar só
  // DDD+número, e recoloca no final — evita duplicar o "55".
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // A esta altura, digits deveria ser só DDD (2) + número local (8 ou 9).
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  const numeroLocal = digits.slice(2);
  if (numeroLocal.length === 9 && numeroLocal[0] !== "9") return null;

  return `55${digits}`;
}

/** Monta o link wa.me com o telefone do paciente (se houver) e a mensagem já preenchida. */
export function buildWhatsAppUrl(telefone: string | null, mensagem: string) {
  const digits = telefone ? telefone.replace(/\D/g, "") : "";
  // Números brasileiros sem DDI têm 10-11 dígitos (DDD + número). Se já
  // vier com DDI (mais de 11 dígitos), usa como está.
  const numero = digits ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}

/** Mensagem de confirmação de consulta — dataFormatada no padrão "dd/mm", horaFormatada "HH:mm". */
export function buildAppointmentReminderMessage(
  nomePaciente: string,
  dataFormatada: string,
  horaFormatada: string
): string {
  return `Oi ${nomePaciente}! Passando para confirmar nossa consulta ${dataFormatada} às ${horaFormatada}`;
}
