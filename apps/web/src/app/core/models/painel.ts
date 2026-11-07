import type { TipoEntrega } from './pedido';
import type { SalgadoDoProdutor } from './producao';
import type { ResumoDosFiados } from './relatorios';

interface Referencia {
  id: string;
  nome: string;
}

export interface EntregaDoDia {
  id: string;
  numero: number;
  /** HH:MM, ou null quando o cliente não marcou horário. */
  horario: string | null;
  tipoEntrega: TipoEntrega;
  enderecoEntrega: string | null;
  cliente: Referencia;
  unidades: number;
}

export interface DiaDoPainel {
  data: string;
  /** Salgados de todos os produtores. */
  unidades: number;
  /** Só com conta ligada a um produtor. */
  minhasUnidades: number | null;
  meusSalgados: SalgadoDoProdutor[] | null;
}

export interface Ganho {
  de: string;
  ate: string;
  unidades: number;
  /** Valor dos salgados feitos, já com a parte dos descontos. */
  produzidoCentavos: number;
}

/** Tela inicial de quem entrou. */
export interface Painel {
  data: string;
  produtor: Referencia | null;
  hoje: {
    quantidadePedidos: number;
    unidades: number;
    /** Confirmados que ainda não saíram, por horário. */
    aEntregar: EntregaDoDia[];
    semPagamento: { valorCentavos: number; pedidos: number[] };
  };
  /** Hoje e os seis dias seguintes. */
  proximosDias: DiaDoPainel[];
  ganhos: { semana: Ganho; mes: Ganho } | null;
  familia: {
    semana: {
      de: string;
      ate: string;
      unidades: number;
      faturamentoCentavos: number;
      caixaCentavos: number;
    };
    fiados: ResumoDosFiados;
    /** Rascunhos com entrega nos próximos dias: ainda fora da produção. */
    rascunhos: number;
  };
}
