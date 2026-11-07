import type { Preparo, UnidadeVenda } from './produto';

export const STATUS_PEDIDO = ['RASCUNHO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export type StatusPagamento = 'PENDENTE' | 'PARCIAL' | 'PAGO';
export type TipoEntrega = 'RETIRADA' | 'ENTREGA';

export const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'FIADO'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

interface Referencia {
  id: string;
  nome: string;
}

/** Cartão da lista de pedidos. */
export interface PedidoResumo {
  id: string;
  numero: number;
  status: StatusPedido;
  statusPagamento: StatusPagamento;
  tipoEntrega: TipoEntrega;
  /** AAAA-MM-DD */
  dataEntrega: string;
  /** HH:MM */
  horarioEntrega: string | null;
  cliente: Referencia;
  quantidadeItens: number;
  totalCentavos: number;
  totalPagoCentavos: number;
  saldoDevedorCentavos: number;
  temDesconto: boolean;
  temFiado: boolean;
}

export interface ResumoFinanceiro {
  subtotalCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  /** Só dinheiro e PIX; o fiado não quita. */
  totalPagoCentavos: number;
  totalFiadoCentavos: number;
  saldoDevedorCentavos: number;
}

export interface ItemPedido {
  id: string;
  produto: Referencia;
  produtor: Referencia;
  produtorPadrao: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  precoUnitarioCentavos: number;
  subtotalCentavos: number;
  observacao: string | null;
}

export interface Pagamento {
  id: string;
  forma: FormaPagamento;
  valorCentavos: number;
  registradoPor: Referencia;
  criadoEm: string;
  estornadoEm: string | null;
  estornadoPor: Referencia | null;
}

export interface PedidoDetalhe {
  id: string;
  numero: number;
  status: StatusPedido;
  statusPagamento: StatusPagamento;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string | null;
  observacao: string | null;
  /** Onde entregar; pode ser diferente do endereço do cadastro do cliente. */
  enderecoEntrega: string | null;
  cliente: Referencia & { telefone: string | null; endereco: string | null; ativo: boolean };
  registradoPor: Referencia;
  resumo: ResumoFinanceiro;
  itens: ItemPedido[];
  pagamentos: Pagamento[];
  transicoesPermitidas: StatusPedido[];
  editavel: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosPedido {
  clienteId: string;
  tipoEntrega: TipoEntrega;
  dataEntrega: string;
  horarioEntrega: string | null;
  descontoCentavos: number;
  observacao: string | null;
  /** Só em entrega; null usa o endereço do cadastro do cliente ao criar. */
  enderecoEntrega: string | null;
}

export type AlteracaoPedido = Partial<DadosPedido>;

export interface NovoItem {
  produtoId: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  produtorId?: string;
  observacao?: string | null;
}

export interface AlteracaoItem {
  quantidade?: number;
  produtorId?: string;
  observacao?: string | null;
}

export interface NovoPagamento {
  forma: FormaPagamento;
  valorCentavos: number;
}

export interface ConsultaPedidos {
  page: number;
  pageSize: number;
  status?: StatusPedido[];
  busca?: string;
  de?: string;
  ate?: string;
  ordem?: 'asc' | 'desc';
  clienteId?: string;
  /** Só confirmados e concluídos que ainda devem algo; o fiado não quita. */
  faltaPagar?: boolean;
}
