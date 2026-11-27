export interface DataHoraLocal {
  /** AAAA-MM-DD no fuso configurado. */
  data: string;
  /** 0 = domingo ... 6 = sábado. */
  diaSemana: number;
  /** Minutos transcorridos desde 00:00 no fuso configurado (0..1439). */
  minutosDoDia: number;
  /** HH:MM no fuso configurado. */
  horaFormatada: string;
}

export type SituacaoJanelaResumo = 'FORA_DO_DIA' | 'ANTES_DO_HORARIO' | 'NA_JANELA' | 'EXPIRADO';

const DIA_DA_SEMANA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const FORMATO_HORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Converte "HH:MM" em minutos desde 00:00. */
export function minutosDeHorario(horario: string): number {
  const match = FORMATO_HORARIO.exec(horario);
  if (!match) {
    throw new Error(`Horário inválido: ${horario}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Converte um instante UTC para data, dia da semana e minuto local no fuso
 * IANA informado (padrão `America/Sao_Paulo`), sem depender do fuso da máquina.
 */
export function obterDataHoraLocal(agora: Date, fusoHorario = 'America/Sao_Paulo'): DataHoraLocal {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partes = new Map<string, string>();
  for (const parte of formatador.formatToParts(agora)) {
    partes.set(parte.type, parte.value);
  }

  const ano = partes.get('year') ?? '1970';
  const mes = partes.get('month') ?? '01';
  const dia = partes.get('day') ?? '01';
  const weekday = partes.get('weekday') ?? 'Sun';
  // ICU/Node pode retornar "24" na meia-noite com hour12: false.
  const horaBruta = Number(partes.get('hour') ?? '0');
  const hora = horaBruta === 24 ? 0 : horaBruta;
  const minuto = Number(partes.get('minute') ?? '0');

  return {
    data: `${ano}-${mes}-${dia}`,
    diaSemana: DIA_DA_SEMANA[weekday] ?? 0,
    minutosDoDia: hora * 60 + minuto,
    horaFormatada: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
  };
}

/**
 * Avalia se um resumo diário deve disparar agora ou já passou da janela de
 * recuperação dentro do mesmo dia local (nunca dispara para dias anteriores).
 */
export function avaliarJanelaResumo(
  agora: Date,
  regra: {
    diasSemana: readonly number[];
    horarioResumo: string | null;
    fusoHorario: string;
    toleranciaAtrasoMinutos: number;
  },
): { local: DataHoraLocal; situacao: SituacaoJanelaResumo } {
  const local = obterDataHoraLocal(agora, regra.fusoHorario);
  if (!regra.horarioResumo || !regra.diasSemana.includes(local.diaSemana)) {
    return { local, situacao: 'FORA_DO_DIA' };
  }
  const alvo = minutosDeHorario(regra.horarioResumo);
  if (local.minutosDoDia < alvo) {
    return { local, situacao: 'ANTES_DO_HORARIO' };
  }
  if (local.minutosDoDia <= alvo + regra.toleranciaAtrasoMinutos) {
    return { local, situacao: 'NA_JANELA' };
  }
  return { local, situacao: 'EXPIRADO' };
}

function diasDesdeEpoch(data: string): number {
  const [ano = 1970, mes = 1, dia = 1] = data.split('-').map(Number);
  return Math.floor(Date.UTC(ano, mes - 1, dia) / 86_400_000);
}

/**
 * Calcula o instante UTC limite (fim do último minuto tolerado no mesmo dia
 * local) até o qual um resumo diário pode ser despachado automaticamente.
 */
export function calcularFimJanelaResumo(
  agora: Date,
  regra: {
    horarioResumo: string | null;
    fusoHorario: string;
    toleranciaAtrasoMinutos: number;
  },
): Date | null {
  if (!regra.horarioResumo) return null;
  const local = obterDataHoraLocal(agora, regra.fusoHorario);
  const [ano = 1970, mes = 1, dia = 1] = local.data.split('-').map(Number);
  const alvo = minutosDeHorario(regra.horarioResumo);
  const fimMinutos = Math.min(alvo + regra.toleranciaAtrasoMinutos, 23 * 60 + 59);
  const fimHora = Math.floor(fimMinutos / 60);
  const fimMin = fimMinutos % 60;

  let instanteMs = Date.UTC(ano, mes - 1, dia, fimHora, fimMin, 59, 999);
  const diaAlvo = diasDesdeEpoch(local.data);

  for (let i = 0; i < 2; i += 1) {
    const atual = obterDataHoraLocal(new Date(instanteMs), regra.fusoHorario);
    const diffDias = diaAlvo - diasDesdeEpoch(atual.data);
    const diffMinutos = diffDias * 1440 + (fimMinutos - atual.minutosDoDia);
    if (diffMinutos === 0) break;
    instanteMs += diffMinutos * 60_000;
  }

  return new Date(instanteMs);
}
