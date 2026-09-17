/**
 * Conversão de horário "de parede" (sem fuso, ex. o valor de um
 * <input type="datetime-local">) para/de um instante UTC, sempre usando um
 * fuso IANA explícito — nunca o fuso do processo que executa o código.
 *
 * Por quê: uma Netlify Function pode rodar em qualquer região, então
 * `new Date("2026-09-20T14:00")` ou `date.toLocaleString()` sem `timeZone`
 * dependem do fuso do servidor, não do fuso do profissional. O Node inclui
 * o banco IANA completo (ICU), então passar `timeZone` explicitamente ao
 * `Intl.DateTimeFormat` dá o mesmo resultado em qualquer servidor físico.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

function getPartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Algumas implementações de ICU retornam "24" para meia-noite com hour12:false.
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
  };
}

/**
 * Converte um horário de parede local (formato "AAAA-MM-DDTHH:mm", como vem
 * de um <input type="datetime-local">) interpretado no fuso informado, para
 * o instante UTC equivalente.
 *
 * Estratégia: trata o horário de parede como se já fosse UTC (um "chute"),
 * descobre como esse instante apareceria no fuso alvo, e corrige o chute
 * pela diferença. Isso captura o offset real do fuso (incluindo horário de
 * verão, se houver) naquela data específica.
 */
export function zonedWallTimeToUtc(localDateTime: string, timeZone: string): Date {
  const [datePart, timePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const partsInZone = getPartsInTimeZone(new Date(guessUtcMs), timeZone);
  const zoneAsUtcMs = Date.UTC(
    partsInZone.year,
    partsInZone.month - 1,
    partsInZone.day,
    partsInZone.hour,
    partsInZone.minute,
    0
  );
  const offsetMs = guessUtcMs - zoneAsUtcMs;

  return new Date(guessUtcMs + offsetMs);
}

/** Formata um instante UTC (timestamptz vindo do banco) no fuso informado, em pt-BR. */
export function formatInTimeZone(
  isoUtc: string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  }).format(new Date(isoUtc));
}

/**
 * Decompõe um instante UTC (timestamptz) nos campos de data/hora de parede
 * no fuso informado — usado para posicionar consultas na grade do
 * calendário (dia/hora local do profissional), nunca o fuso do servidor.
 */
export function utcInstantToZonedDateTime(isoUtc: string, timeZone: string) {
  const parts = getPartsInTimeZone(new Date(isoUtc), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ...parts,
    dateStr: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    timeStr: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** Data de "hoje" (yyyy-mm-dd) no fuso informado — nunca no fuso do servidor. */
export function todayInTimeZone(timeZone: string): string {
  return utcInstantToZonedDateTime(new Date().toISOString(), timeZone).dateStr;
}
