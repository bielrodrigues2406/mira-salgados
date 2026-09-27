import type { Preparo } from './produto';

interface Referencia {
  id: string;
  nome: string;
}

export interface LinhaDoProdutor {
  produto: Referencia;
  preparo: Preparo;
  centos: number;
  avulsas: number;
  /** Quantidade vezes preço, antes do desconto. */
  valorCentavos: number;
}

export interface ParteDoProdutor {
  produtor: Referencia;
  unidades: number;
  /** Décimos de ponto percentual: 568 é 56,8%. Somam 1000. */
  participacaoDecimos: number;
  itens: LinhaDoProdutor[];
  valorItensCentavos: number;
  /** Parte dos descontos dos pedidos que cabe a este produtor. */
  descontoCentavos: number;
  valorProduzidoCentavos: number;
  aReceberCentavos: number;
  pendenteCentavos: number;
}

/** Pedidos confirmados e concluídos com entrega na data (decisões D1, D2 e D3). */
export interface AcertoDiario {
  data: string;
  quantidadePedidos: number;
  unidades: number;
  valorMovimentadoCentavos: number;
  caixa: { pixCentavos: number; dinheiroCentavos: number; totalCentavos: number };
  fiado: { valorCentavos: number; pedidos: number[] };
  semPagamento: { valorCentavos: number; pedidos: number[] };
  totalProduzidoCentavos: number;
  produtores: ParteDoProdutor[];
  somaAReceberCentavos: number;
  somaPendenteCentavos: number;
}

/** Datas de entrega de `de` a `ate`, inclusive (AAAA-MM-DD). */
export interface Periodo {
  de: string;
  ate: string;
}

export interface Faturamento extends Periodo {
  quantidadePedidos: number;
  unidades: number;
  /** Itens menos descontos. */
  faturamentoCentavos: number;
  descontosCentavos: number;
  /** Dinheiro e PIX. */
  recebidoCentavos: number;
  fiadoCentavos: number;
  /** Faturado e ainda não recebido, fiado incluído. */
  aReceberCentavos: number;
  ticketMedioCentavos: number;
  /** Só os dias com pedidos. */
  porDia: { data: string; quantidadePedidos: number; faturamentoCentavos: number }[];
}

export interface ItemVendido {
  posicao: number;
  produto: Referencia;
  preparo: Preparo;
  unidades: number;
  /** Quantidade vezes preço, antes dos descontos. */
  valorCentavos: number;
  quantidadePedidos: number;
}

export interface ProducaoDoProdutor {
  produtor: Referencia;
  unidades: number;
  /** Quantidade vezes preço, antes dos descontos. */
  valorCentavos: number;
  quantidadePedidos: number;
  itens: { produto: Referencia; preparo: Preparo; unidades: number; valorCentavos: number }[];
}

/** Volume do período inteiro, para a participação de cada linha. */
export interface ResumoDeVolume {
  unidades: number;
  valorCentavos: number;
}

export interface ClienteComFiado {
  cliente: Referencia & { telefone: string | null };
  emAbertoCentavos: number;
  /** Entrega do pedido mais antigo com fiado em aberto. */
  desde: string;
  pedidos: { id: string; numero: number; dataEntrega: string; emAbertoCentavos: number }[];
}

export interface ResumoDosFiados {
  totalEmAbertoCentavos: number;
  quantidadePedidos: number;
}

export interface ConsultaDePeriodo extends Periodo {
  page: number;
  pageSize: number;
  produtorId?: string;
}

export interface ConsultaDeFiados {
  page: number;
  pageSize: number;
  clienteId?: string;
}
