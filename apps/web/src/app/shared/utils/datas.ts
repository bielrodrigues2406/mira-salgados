// Datas de entrega são dias de calendário (AAAA-MM-DD), sem fuso: o pedido é
// para "sexta-feira", não para um instante. Tudo aqui trabalha no fuso do
// aparelho, que é o da família.

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function paraTextoDeData(data: Date): string {
  return `${String(data.getFullYear())}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

export function deTextoDeData(texto: string): Date {
  const [ano = 0, mes = 1, dia = 1] = texto.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function hoje(agora: Date = new Date()): string {
  return paraTextoDeData(agora);
}

export function somarDias(texto: string, dias: number): string {
  const data = deTextoDeData(texto);
  data.setDate(data.getDate() + dias);
  return paraTextoDeData(data);
}

/** "Sex, 2 out" */
export function dataCurta(texto: string): string {
  const data = deTextoDeData(texto);
  return `${DIAS[data.getDay()] ?? ''}, ${String(data.getDate())} ${MESES[data.getMonth()] ?? ''}`;
}

/** "Sexta-feira, 2 de outubro" */
export function dataPorExtenso(texto: string): string {
  const data = deTextoDeData(texto);
  return `${DIAS_EXTENSO[data.getDay()] ?? ''}, ${String(data.getDate())} de ${MESES_EXTENSO[data.getMonth()] ?? ''}`;
}

/**
 * Quando a encomenda vence, como no cartão do design: "11:30" ou "Sem horário"
 * para hoje; "Sáb, 3 out · 09:00" ou "Dom, 4 out" para outros dias.
 */
export function quandoEntregar(data: string, horario: string | null, referencia: string): string {
  if (data === referencia) return horario ?? 'Sem horário';
  const dia = dataCurta(data);
  return horario ? `${dia} · ${horario}` : dia;
}

/** "29 set, 14:12", para lançamentos com data e hora. */
export function momentoCurto(iso: string): string {
  const data = new Date(iso);
  return `${String(data.getDate())} ${MESES[data.getMonth()] ?? ''}, ${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

/** "Sex, 2 de outubro de 2026" */
export function dataCompleta(texto: string): string {
  const data = deTextoDeData(texto);
  return `${DIAS[data.getDay()] ?? ''}, ${String(data.getDate())} de ${MESES_EXTENSO[data.getMonth()] ?? ''} de ${String(data.getFullYear())}`;
}

const FORMATO_DE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** A data, se for AAAA-MM-DD e existir no calendário; 2026-02-30 não passa. */
export function dataDoCalendario(texto: string | undefined): string | undefined {
  if (!texto || !FORMATO_DE_DATA.test(texto)) return undefined;
  return paraTextoDeData(deTextoDeData(texto)) === texto ? texto : undefined;
}
