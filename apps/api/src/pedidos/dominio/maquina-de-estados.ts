import { BusinessRuleError } from '../../common/errors/domain.errors.js';
import type { StatusPedido } from './enums.js';

// Única fonte das transições permitidas. Condições que dependem do conteúdo do
// pedido (itens, pagamentos) ficam em validarCondicoesDaTransicao.
const TRANSICOES: Readonly<Record<StatusPedido, readonly StatusPedido[]>> = {
  RASCUNHO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['CONCLUIDO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
};

const ROTULOS: Record<StatusPedido, string> = {
  RASCUNHO: 'rascunho',
  CONFIRMADO: 'confirmado',
  CONCLUIDO: 'concluído',
  CANCELADO: 'cancelado',
};

export function transicoesPermitidas(atual: StatusPedido): readonly StatusPedido[] {
  return TRANSICOES[atual];
}

export function ehTerminal(status: StatusPedido): boolean {
  return TRANSICOES[status].length === 0;
}

export function validarTransicao(de: StatusPedido, para: StatusPedido): void {
  if (!TRANSICOES[de].includes(para)) {
    throw new BusinessRuleError(
      'TRANSICAO_INVALIDA',
      `Um pedido ${ROTULOS[de]} não pode passar para ${ROTULOS[para]}.`,
      { de, para, permitidas: TRANSICOES[de] },
    );
  }
}

export interface EstadoParaTransicao {
  quantidadeItens: number;
  pagamentosAtivos: number;
}

/** Condições de conteúdo, verificadas depois de a transição em si ser permitida. */
export function validarCondicoesDaTransicao(para: StatusPedido, estado: EstadoParaTransicao): void {
  if (para === 'CONFIRMADO' && estado.quantidadeItens === 0) {
    throw new BusinessRuleError(
      'PEDIDO_SEM_ITENS',
      'Adicione ao menos um item antes de confirmar.',
    );
  }
  // Decisão D4: cancelar exige estornar antes, para o caixa não ficar com
  // dinheiro sem pedido correspondente.
  if (para === 'CANCELADO' && estado.pagamentosAtivos > 0) {
    throw new BusinessRuleError(
      'PEDIDO_COM_PAGAMENTOS',
      'Estorne os pagamentos antes de cancelar o pedido.',
      { pagamentosAtivos: estado.pagamentosAtivos },
    );
  }
}
