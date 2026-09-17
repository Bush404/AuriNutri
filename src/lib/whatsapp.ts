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
