import type { PedidoDetalhe } from '../../../core/models/pedido';

/** Resultado de uma gravação: o pedido atualizado e a confirmação a anunciar. */
export interface AlteracaoDoPedido {
  pedido: PedidoDetalhe;
  aviso: string;
}
