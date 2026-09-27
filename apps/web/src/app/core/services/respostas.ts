import type { ApiEnvelope, Pagina } from '../models/api';

/** Desembrulha uma coleção paginada; sem meta, trata a lista como página única. */
export function paginaDe<T>(corpo: ApiEnvelope<T[]>): Pagina<T> {
  const itens = corpo.data;
  return {
    itens,
    meta: corpo.meta ?? { page: 1, pageSize: itens.length, total: itens.length, totalPages: 1 },
  };
}

type ValorDeParametro = string | number | boolean;

/** Parâmetros de query sem as chaves indefinidas, que o HttpParams enviaria como texto. */
export function parametros(
  valores: Record<string, ValorDeParametro | undefined>,
): Record<string, ValorDeParametro> {
  const resultado: Record<string, ValorDeParametro> = {};
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== undefined) resultado[chave] = valor;
  }
  return resultado;
}
