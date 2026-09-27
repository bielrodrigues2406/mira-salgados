export interface Cliente {
  id: string;
  nome: string;
  /** Só dígitos, com DDD. */
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  /** Pedidos confirmados e concluídos, menos o pago em dinheiro e PIX. */
  saldoDevedorCentavos: number;
  temFiado: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ClienteDetalhe extends Cliente {
  quantidadePedidosComSaldo: number;
  pedidosComSaldo: {
    id: string;
    numero: number;
    dataEntrega: string;
    saldoDevedorCentavos: number;
  }[];
}

export interface NovoCliente {
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export interface AlteracaoCliente extends Partial<NovoCliente> {
  ativo?: boolean;
}

export interface ConsultaClientes {
  page: number;
  pageSize: number;
  busca?: string;
  ativo?: boolean;
}
