import {
  type Centavos,
  multiplicar,
  somar,
  subtrair,
  ZERO_CENTAVOS,
} from '../../common/utils/dinheiro.js';
import { FORMAS_LIQUIDAS, type FormaPagamento, type StatusPagamento } from './enums.js';

export interface ItemParaCalculo {
  quantidade: number;
  precoUnitario: Centavos;
}

export interface PagamentoParaCalculo {
  forma: FormaPagamento;
  valor: Centavos;
}

export interface ResumoFinanceiro {
  subtotal: Centavos;
  desconto: Centavos;
  total: Centavos;
  /** Só DINHEIRO e PIX (decisão D1). */
  totalPago: Centavos;
  /** Valor registrado como fiado; não abate o saldo. */
  totalFiado: Centavos;
  saldoDevedor: Centavos;
  statusPagamento: StatusPagamento;
}

export function subtotalItem(item: ItemParaCalculo): Centavos {
  return multiplicar(item.precoUnitario, item.quantidade);
}

/**
 * Estado de pagamento derivado, nunca persistido. Diferença em relação à
 * fórmula da especificação: um pedido de total zero (desconto integral) é PAGO,
 * não PENDENTE, porque não há nada a receber.
 */
export function statusDoPagamento(total: Centavos, totalPago: Centavos): StatusPagamento {
  if (totalPago >= total) return 'PAGO';
  return totalPago === 0 ? 'PENDENTE' : 'PARCIAL';
}

export interface TotaisDoPedido {
  subtotal: Centavos;
  desconto: Centavos;
  totalPago: Centavos;
  totalFiado: Centavos;
}

/**
 * Deriva total, saldo e estado de pagamento de somas já feitas (em memória ou
 * no banco). Diferença em relação à especificação: não há taxa de entrega, que
 * a família decidiu não controlar no sistema (decisão D3 revista).
 */
export function resumoDeTotais(totais: TotaisDoPedido): ResumoFinanceiro {
  const total = subtrair(totais.subtotal, totais.desconto);
  const saldo = subtrair(total, totais.totalPago);
  return {
    ...totais,
    total,
    saldoDevedor: saldo > 0 ? saldo : ZERO_CENTAVOS,
    // Sem itens ainda não há o que cobrar: o total zero do desconto integral é
    // PAGO, o do pedido vazio continua PENDENTE.
    statusPagamento:
      totais.subtotal === 0 ? 'PENDENTE' : statusDoPagamento(total, totais.totalPago),
  };
}

export function resumoFinanceiro(
  itens: readonly ItemParaCalculo[],
  desconto: Centavos,
  pagamentos: readonly PagamentoParaCalculo[],
): ResumoFinanceiro {
  const liquidos = pagamentos.filter((pagamento) => FORMAS_LIQUIDAS.includes(pagamento.forma));
  const fiados = pagamentos.filter((pagamento) => pagamento.forma === 'FIADO');
  return resumoDeTotais({
    subtotal: somar(...itens.map(subtotalItem)),
    desconto,
    totalPago: somar(...liquidos.map((pagamento) => pagamento.valor)),
    totalFiado: somar(...fiados.map((pagamento) => pagamento.valor)),
  });
}
