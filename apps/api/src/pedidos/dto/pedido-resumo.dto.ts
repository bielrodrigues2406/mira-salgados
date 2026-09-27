import type { ResumoFinanceiro } from '../dominio/calculos.js';
import type { StatusPagamento, StatusPedido, TipoEntrega } from '../dominio/enums.js';
import type { Pedido } from '../pedido.entity.js';
import { horarioCurto } from './pedido-resposta.dto.js';

export interface PedidoComTotais {
  pedido: Pedido;
  resumo: ResumoFinanceiro;
  quantidadeItens: number;
}

/** Cartão da lista: o suficiente para a tela de pedidos, sem itens nem pagamentos. */
export class PedidoResumoDto {
  id: string;
  numero: number;
  status: StatusPedido;
  statusPagamento: StatusPagamento;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string | null;
  cliente: { id: string; nome: string };
  quantidadeItens: number;
  totalCentavos: number;
  totalPagoCentavos: number;
  saldoDevedorCentavos: number;
  temDesconto: boolean;
  /** Há fiado registrado e ainda existe saldo a receber. */
  temFiado: boolean;

  static de({ pedido, resumo, quantidadeItens }: PedidoComTotais): PedidoResumoDto {
    if (!pedido.cliente) throw new Error('Pedido sem cliente carregado.');
    return Object.assign(new PedidoResumoDto(), {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      statusPagamento: resumo.statusPagamento,
      tipoEntrega: pedido.tipoEntrega,
      dataEntrega: pedido.dataEntrega,
      horarioEntrega: horarioCurto(pedido.horarioEntrega),
      cliente: { id: pedido.cliente.id, nome: pedido.cliente.nome },
      quantidadeItens,
      totalCentavos: resumo.total,
      totalPagoCentavos: resumo.totalPago,
      saldoDevedorCentavos: resumo.saldoDevedor,
      temDesconto: resumo.desconto > 0,
      temFiado: resumo.totalFiado > 0 && resumo.saldoDevedor > 0,
    });
  }
}
