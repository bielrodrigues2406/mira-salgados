import type { ApiEnvelope, Pagina, PaginaComResumo } from '../models/api';

/** Desembrulha uma coleção paginada; sem meta, trata a lista como página única. */
export function paginaDe<T>(corpo: ApiEnvelope<T[]>): Pagina<T> {
  const itens = corpo.data;
  return {
    itens,
    meta: corpo.meta ?? { page: 1, pageSize: itens.length, total: itens.length, totalPages: 1 },
  };
}

/** Página de relatório; o resumo vem do envelope, e na falta dele vale `vazio`. */
export function paginaComResumoDe<T, R>(corpo: ApiEnvelope<T[]>, vazio: R): PaginaComResumo<T, R> {
  return { ...paginaDe(corpo), resumo: (corpo.resumo as R | undefined) ?? vazio };
}

type ValorDeParametro = string | number | boolean | readonly string[];

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
