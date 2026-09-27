import type { StatusPedido, TipoEntrega } from './pedido';
import type { Preparo, UnidadeVenda } from './produto';

interface Referencia {
  id: string;
  nome: string;
}

export interface ItemNaProducao {
  id: string;
  produto: Referencia;
  produtor: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  /** Salgados a fazer: um cento são cem unidades. */
  unidades: number;
  observacao: string | null;
}

export interface PedidoNaProducao {
  id: string;
  numero: number;
  status: StatusPedido;
  tipoEntrega: TipoEntrega;
  observacao: string | null;
  cliente: Referencia;
  unidades: number;
  itens: ItemNaProducao[];
}

export interface FaixaDeHorario {
  /** HH:MM, ou null na faixa dos pedidos sem horário. */
  horario: string | null;
  unidades: number;
  pedidos: PedidoNaProducao[];
}

export interface LinhaConsolidada {
  produto: Referencia;
  produtor: Referencia;
  unidades: number;
  centos: number;
  avulsas: number;
  /** Números dos pedidos, em ordem crescente. */
  pedidos: number[];
}

export interface GrupoDePreparo {
  preparo: Preparo;
  unidades: number;
  linhas: LinhaConsolidada[];
}

/** Pedidos confirmados e concluídos com entrega no dia. */
export interface ProducaoDoDia {
  /** AAAA-MM-DD */
  data: string;
  quantidadePedidos: number;
  quantidadeProdutores: number;
  unidades: number;
  /** Os três preparos, sempre na mesma ordem. */
  porPreparo: { preparo: Preparo; unidades: number }[];
  /** Carga de cada produtor, da maior para a menor. */
  porProdutor: { produtor: Referencia; unidades: number }[];
  faixas: FaixaDeHorario[];
  consolidado: GrupoDePreparo[];
}
