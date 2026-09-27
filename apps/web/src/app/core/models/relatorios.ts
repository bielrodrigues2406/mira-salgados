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
