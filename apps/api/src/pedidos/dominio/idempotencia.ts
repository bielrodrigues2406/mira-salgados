import { createHash } from 'node:crypto';

import { BusinessRuleError } from '../../common/errors/domain.errors.js';

const TAMANHO_MAXIMO_CHAVE = 128;
const FORMATO_CHAVE = /^[\x21-\x7E]+$/;

/**
 * Normaliza e valida o cabeçalho `Idempotency-Key`. Quando ausente, devolve
 * undefined; quando enviado vazio, grande demais ou com caracteres de controle,
 * falha com erro de domínio antes de tocar o banco.
 */
export function normalizarChaveIdempotencia(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  const aparado = valor.trim();
  if (
    aparado.length === 0 ||
    aparado.length > TAMANHO_MAXIMO_CHAVE ||
    !FORMATO_CHAVE.test(aparado)
  ) {
    throw new BusinessRuleError(
      'CHAVE_IDEMPOTENCIA_INVALIDA',
      'A chave de idempotência deve ter entre 1 e 128 caracteres visíveis sem espaços.',
    );
  }
  return aparado;
}

/**
 * Serialização determinística (chaves de objeto ordenadas, ordem de arrays
 * preservada) para detectar reaproveitamento da mesma chave com conteúdo distinto.
 */
export function serializarCanonico(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) {
    return `[${valor.map((item) => serializarCanonico(item)).join(',')}]`;
  }
  const entradas = Object.entries(valor as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${serializarCanonico(v)}`).join(',')}}`;
}

export function hashCanonicaRequisicao(payload: unknown): string {
  return createHash('sha256').update(serializarCanonico(payload)).digest('hex');
}
