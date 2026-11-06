import type { Periodo } from '../../core/models/relatorios';
import {
  dataDoCalendario,
  deTextoDeData,
  diasNoIntervalo,
  primeiroDiaDoMes,
  somarDias,
  ultimoDiaDoMes,
} from '../../shared/utils/datas';
import { type Atalho, erroDoPeriodo } from '../relatorios/periodo';

/** O mesmo limite da API de produção por dia. */
export const MAXIMO_DE_DIAS_DA_PRODUCAO = 31;
export const DIAS_PADRAO = 7;

/** Segunda-feira da semana da data (a semana vai de segunda a domingo). */
export function segundaDaSemana(data: string): string {
  return somarDias(data, -((deTextoDeData(data).getDay() + 6) % 7));
}

/** Olhando para a frente: é o que falta produzir. */
export function atalhosDaProducao(hoje: string): Atalho[] {
  const proximoMes = somarDias(ultimoDiaDoMes(hoje), 1);
  const segunda = segundaDaSemana(hoje);
  return [
    { rotulo: '7 dias', de: hoje, ate: somarDias(hoje, 6) },
    { rotulo: 'Esta semana', de: segunda, ate: somarDias(segunda, 6) },
    { rotulo: 'Semana que vem', de: somarDias(segunda, 7), ate: somarDias(segunda, 13) },
    { rotulo: '14 dias', de: hoje, ate: somarDias(hoje, 13) },
    { rotulo: 'Este mês', de: primeiroDiaDoMes(hoje), ate: ultimoDiaDoMes(hoje) },
    { rotulo: 'Próximo mês', de: proximoMes, ate: ultimoDiaDoMes(proximoMes) },
  ];
}

/** Período da URL: `data` é o início; sem `ate` válido, são 7 dias. */
export function periodoDaProducao(
  data: string | undefined,
  ate: string | undefined,
  hoje: string,
): Periodo {
  const de = dataDoCalendario(data) ?? hoje;
  const fim = dataDoCalendario(ate);
  if (fim && erroDoPeriodo({ de, ate: fim }, MAXIMO_DE_DIAS_DA_PRODUCAO) === null) {
    return { de, ate: fim };
  }
  return { de, ate: somarDias(de, DIAS_PADRAO - 1) };
}

function ehMesInteiro({ de, ate }: Periodo): boolean {
  return de === primeiroDiaDoMes(de) && ate === ultimoDiaDoMes(de);
}

/** O período vizinho, do mesmo tamanho; um mês inteiro anda de mês em mês. */
export function periodoVizinho(periodo: Periodo, sentido: 1 | -1): Periodo {
  if (ehMesInteiro(periodo)) {
    const base = sentido === 1 ? somarDias(periodo.ate, 1) : somarDias(periodo.de, -1);
    return { de: primeiroDiaDoMes(base), ate: ultimoDiaDoMes(base) };
  }
  const dias = diasNoIntervalo(periodo.de, periodo.ate);
  return { de: somarDias(periodo.de, sentido * dias), ate: somarDias(periodo.ate, sentido * dias) };
}
