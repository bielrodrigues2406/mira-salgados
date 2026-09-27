import type { PedidoComSaldo, SaldoDoCliente } from '../../pedidos/saldo-devedor.service.js';
import type { Cliente } from '../cliente.entity.js';

export class ClienteRespostaDto {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  /** Pedidos CONFIRMADO e CONCLUIDO, menos o pago em dinheiro e PIX. */
  saldoDevedorCentavos: number;
  /** Algum pedido com saldo tem fiado registrado. */
  temFiado: boolean;
  criadoEm: string;
  atualizadoEm: string;

  static de(cliente: Cliente, saldo: SaldoDoCliente | undefined): ClienteRespostaDto {
    return Object.assign(new ClienteRespostaDto(), {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      ativo: cliente.ativo,
      saldoDevedorCentavos: saldo?.saldoDevedor ?? 0,
      temFiado: saldo?.temFiado ?? false,
      criadoEm: cliente.criadoEm.toISOString(),
      atualizadoEm: cliente.atualizadoEm.toISOString(),
    });
  }
}

export class ClienteDetalheDto extends ClienteRespostaDto {
  quantidadePedidosComSaldo: number;
  /** Os mais antigos primeiro, até o limite; o total está em quantidadePedidosComSaldo. */
  pedidosComSaldo: {
    id: string;
    numero: number;
    dataEntrega: string;
    saldoDevedorCentavos: number;
  }[];

  static detalhe(
    cliente: Cliente,
    saldo: SaldoDoCliente | undefined,
    pedidos: readonly PedidoComSaldo[],
  ): ClienteDetalheDto {
    return Object.assign(new ClienteDetalheDto(), ClienteRespostaDto.de(cliente, saldo), {
      quantidadePedidosComSaldo: saldo?.pedidosComSaldo ?? 0,
      pedidosComSaldo: pedidos.map((pedido) => ({
        id: pedido.id,
        numero: pedido.numero,
        dataEntrega: pedido.dataEntrega,
        saldoDevedorCentavos: pedido.saldoDevedor,
      })),
    });
  }
}
