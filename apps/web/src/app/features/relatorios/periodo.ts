import type { Periodo } from '../../core/models/relatorios';
import {
  dataDoCalendario,
  diasNoIntervalo,
  primeiroDiaDoMes,
  segundaDaSemana,
  somarDias,
  ultimoDiaDoMes,
} from '../../shared/utils/datas';

/** O mesmo limite da API: um ano, com folga para o bissexto. */
export const MAXIMO_DE_DIAS = 366;

export interface Atalho extends Periodo {
  rotulo: string;
}

export function esteMes(hoje: string): Periodo {
  return { de: primeiroDiaDoMes(hoje), ate: ultimoDiaDoMes(hoje) };
}

/** De segunda a domingo. */
export function estaSemana(hoje: string): Periodo {
  const segunda = segundaDaSemana(hoje);
  return { de: segunda, ate: somarDias(segunda, 6) };
}

/** Para fechar as contas de cada um: semana ou mês, o atual e o anterior. */
export function atalhosDoAReceber(hoje: string): Atalho[] {
  const semana = estaSemana(hoje);
  const mesPassado = somarDias(primeiroDiaDoMes(hoje), -1);
  return [
    { rotulo: 'Esta semana', ...semana },
    { rotulo: 'Semana passada', de: somarDias(semana.de, -7), ate: somarDias(semana.de, -1) },
    { rotulo: 'Este mês', ...esteMes(hoje) },
    { rotulo: 'Mês passado', de: primeiroDiaDoMes(mesPassado), ate: mesPassado },
  ];
}

export function atalhosDePeriodo(hoje: string): Atalho[] {
  const mesPassado = somarDias(primeiroDiaDoMes(hoje), -1);
  return [
    { rotulo: 'Este mês', ...esteMes(hoje) },
    { rotulo: 'Mês passado', de: primeiroDiaDoMes(mesPassado), ate: mesPassado },
    { rotulo: 'Últimos 7 dias', de: somarDias(hoje, -6), ate: hoje },
    { rotulo: 'Últimos 30 dias', de: somarDias(hoje, -29), ate: hoje },
  ];
}

/** Por que o período não serve, ou null se serve. */
export function erroDoPeriodo({ de, ate }: Periodo, maximoDeDias = MAXIMO_DE_DIAS): string | null {
  const dias = diasNoIntervalo(de, ate);
  if (dias < 1) return 'A data final precisa ser igual ou posterior à inicial.';
  if (dias > maximoDeDias) {
    return maximoDeDias === MAXIMO_DE_DIAS
      ? 'Escolha um período de até um ano.'
      : `Escolha um período de até ${String(maximoDeDias)} dias.`;
  }
  return null;
}

/** O período da URL, se as duas datas existirem e o intervalo servir; senão, o padrão. */
export function periodoDaUrl(
  de: string | undefined,
  ate: string | undefined,
  hoje: string,
  padrao: (hoje: string) => Periodo = esteMes,
): Periodo {
  const inicio = dataDoCalendario(de);
  const fim = dataDoCalendario(ate);
  if (inicio && fim && erroDoPeriodo({ de: inicio, ate: fim }) === null) {
    return { de: inicio, ate: fim };
  }
  return padrao(hoje);
}
