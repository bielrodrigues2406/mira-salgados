import type { Periodo } from '../../core/models/relatorios';
import {
  dataDoCalendario,
  diasNoIntervalo,
  primeiroDiaDoMes,
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
export function erroDoPeriodo({ de, ate }: Periodo): string | null {
  const dias = diasNoIntervalo(de, ate);
  if (dias < 1) return 'A data final precisa ser igual ou posterior à inicial.';
  if (dias > MAXIMO_DE_DIAS) return 'Escolha um período de até um ano.';
  return null;
}

/** O período da URL, se as duas datas existirem e o intervalo servir; senão, este mês. */
export function periodoDaUrl(
  de: string | undefined,
  ate: string | undefined,
  hoje: string,
): Periodo {
  const inicio = dataDoCalendario(de);
  const fim = dataDoCalendario(ate);
  if (inicio && fim && erroDoPeriodo({ de: inicio, ate: fim }) === null) {
    return { de: inicio, ate: fim };
  }
  return esteMes(hoje);
}
