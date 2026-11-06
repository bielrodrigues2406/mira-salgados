import { type Centavos, somar, ZERO_CENTAVOS } from '../../common/utils/dinheiro.js';
import type { TipoEntrega } from '../../pedidos/dominio/enums.js';
import type { AcertoDiario } from '../acerto/acerto-diario.js';
import type { ResumoDosFiados } from '../fiados/fiados.service.js';
import type { ProducaoDoDia } from '../producao/producao-do-dia.js';
import type { ProducaoPorDia, SalgadoDoProdutor } from '../producao/producao-por-dia.js';
import type { SaldoDoProdutor } from '../saldos/saldos.service.js';

interface Referencia {
  id: string;
  nome: string;
}

export interface Intervalo {
  de: string;
  ate: string;
}

export interface EntregaDoDia {
  id: string;
  numero: number;
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
  /** Só com conta ligada a um produtor: a parte dele. */
  minhasUnidades: number | null;
  meusSalgados: SalgadoDoProdutor[] | null;
}

export interface Ganho extends Intervalo {
  unidades: number;
  /** Valor dos salgados feitos, já com a parte dos descontos. */
  produzido: Centavos;
}

export interface Painel {
  data: string;
  produtor: Referencia | null;
  hoje: {
    quantidadePedidos: number;
    unidades: number;
    /** Confirmados que ainda não saíram, por horário; os sem horário no fim. */
    aEntregar: EntregaDoDia[];
    semPagamento: { valor: Centavos; pedidos: number[] };
  };
  proximosDias: DiaDoPainel[];
  ganhos: { semana: Ganho; mes: Ganho } | null;
  /** Só com conta ligada a um produtor: a receber, já recebido em repasses e o que falta. */
  saldo: SaldoDoProdutor | null;
  familia: {
    semana: Intervalo & { unidades: number; faturamento: Centavos; caixa: Centavos };
    fiados: ResumoDosFiados;
    /** Rascunhos com entrega nos próximos dias: ainda não entram na produção. */
    rascunhos: number;
  };
}

export interface DadosDoPainel {
  data: string;
  produtor: Referencia | null;
  semana: Intervalo;
  mes: Intervalo;
  hoje: ProducaoDoDia;
  proximos: ProducaoPorDia;
  /** Acertos de todos os dias da semana e do mês, sem os dias vazios. */
  acertos: ReadonlyMap<string, AcertoDiario>;
  fiados: ResumoDosFiados;
  rascunhos: number;
  saldo: SaldoDoProdutor | null;
}

export function montarPainel(dados: DadosDoPainel): Painel {
  const { produtor } = dados;
  const acertoDeHoje = dados.acertos.get(dados.data);
  return {
    data: dados.data,
    produtor,
    hoje: {
      quantidadePedidos: dados.hoje.quantidadePedidos,
      unidades: dados.hoje.unidades,
      aEntregar: dados.hoje.faixas.flatMap((faixa) =>
        faixa.pedidos
          .filter((pedido) => pedido.status === 'CONFIRMADO')
          .map((pedido) => ({
            id: pedido.id,
            numero: pedido.numero,
            horario: faixa.horario,
            tipoEntrega: pedido.tipoEntrega,
            enderecoEntrega: pedido.enderecoEntrega,
            cliente: pedido.cliente,
            unidades: pedido.unidades,
          })),
      ),
      semPagamento: acertoDeHoje?.semPagamento ?? { valor: ZERO_CENTAVOS, pedidos: [] },
    },
    proximosDias: dados.proximos.dias.map((dia) => {
      const meu = produtor
        ? dia.produtores.find((carga) => carga.produtor.id === produtor.id)
        : undefined;
      return {
        data: dia.data,
        unidades: dia.unidades,
        minhasUnidades: produtor ? (meu?.unidades ?? 0) : null,
        meusSalgados: produtor ? (meu?.salgados ?? []) : null,
      };
    }),
    // O que a pessoa fez: só até hoje, como o saldo. Pedidos dos próximos dias
    // aparecem em "próximos dias", não aqui.
    ganhos: produtor
      ? {
          semana: ganhoNoIntervalo(dados.acertos, ateHoje(dados.semana, dados.data), produtor.id),
          mes: ganhoNoIntervalo(dados.acertos, ateHoje(dados.mes, dados.data), produtor.id),
        }
      : null,
    saldo: produtor ? dados.saldo : null,
    familia: {
      semana: { ...dados.semana, ...movimentoNoIntervalo(dados.acertos, dados.semana) },
      fiados: dados.fiados,
      rascunhos: dados.rascunhos,
    },
  };
}

function ateHoje(intervalo: Intervalo, hoje: string): Intervalo {
  return { de: intervalo.de, ate: intervalo.ate < hoje ? intervalo.ate : hoje };
}

function acertosDoIntervalo(
  acertos: ReadonlyMap<string, AcertoDiario>,
  { de, ate }: Intervalo,
): AcertoDiario[] {
  // Datas AAAA-MM-DD comparam como texto na mesma ordem do calendário.
  return [...acertos].filter(([data]) => data >= de && data <= ate).map(([, acerto]) => acerto);
}

function ganhoNoIntervalo(
  acertos: ReadonlyMap<string, AcertoDiario>,
  intervalo: Intervalo,
  produtorId: string,
): Ganho {
  const partes = acertosDoIntervalo(acertos, intervalo).flatMap((acerto) =>
    acerto.produtores.filter((parte) => parte.produtor.id === produtorId),
  );
  return {
    ...intervalo,
    unidades: partes.reduce((soma, parte) => soma + parte.unidades, 0),
    produzido: somar(...partes.map((parte) => parte.valorProduzido)),
  };
}

function movimentoNoIntervalo(
  acertos: ReadonlyMap<string, AcertoDiario>,
  intervalo: Intervalo,
): { unidades: number; faturamento: Centavos; caixa: Centavos } {
  const dias = acertosDoIntervalo(acertos, intervalo);
  return {
    unidades: dias.reduce((soma, acerto) => soma + acerto.unidades, 0),
    faturamento: somar(...dias.map((acerto) => acerto.valorMovimentado)),
    caixa: somar(...dias.map((acerto) => acerto.caixa.total)),
  };
}
