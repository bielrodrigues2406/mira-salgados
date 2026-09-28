import type { StatusPedido, TipoEntrega } from '../../pedidos/dominio/enums.js';
import { PREPAROS, type Preparo, type UnidadeVenda } from '../../produtos/preco-produto.entity.js';

export const UNIDADES_POR_CENTO = 100;

interface Referencia {
  id: string;
  nome: string;
}

/** Um item de pedido do dia, já com os nomes; a consulta devolve uma linha por item. */
export interface LinhaDeProducao {
  pedidoId: string;
  numero: number;
  status: StatusPedido;
  /** HH:MM, ou null quando o cliente não marcou horário. */
  horario: string | null;
  tipoEntrega: TipoEntrega;
  observacaoPedido: string | null;
  enderecoEntrega: string | null;
  cliente: Referencia;
  itemId: string;
  produto: Referencia;
  produtor: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  observacaoItem: string | null;
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
  enderecoEntrega: string | null;
  cliente: Referencia;
  unidades: number;
  itens: ItemNaProducao[];
}

export interface FaixaDeHorario {
  horario: string | null;
  unidades: number;
  pedidos: PedidoNaProducao[];
}

/** Volume de um produto num preparo, feito por um produtor, somando todos os pedidos. */
export interface LinhaConsolidada {
  produto: Referencia;
  produtor: Referencia;
  unidades: number;
  /** Quantidade vendida em centos, somada. */
  centos: number;
  /** Quantidade vendida por unidade, somada. */
  avulsas: number;
  /** Números dos pedidos, em ordem crescente. */
  pedidos: number[];
}

export interface GrupoDePreparo {
  preparo: Preparo;
  unidades: number;
  linhas: LinhaConsolidada[];
}

export interface ProducaoDoDia {
  quantidadePedidos: number;
  quantidadeProdutores: number;
  unidades: number;
  /** Os três preparos, sempre nesta ordem, mesmo quando zerados. */
  porPreparo: { preparo: Preparo; unidades: number }[];
  /** Carga de cada produtor, da maior para a menor. */
  porProdutor: { produtor: Referencia; unidades: number }[];
  /** Modo cronológico: por horário, e os sem horário no fim. */
  faixas: FaixaDeHorario[];
  /** Modo consolidado: só os preparos com produção. */
  consolidado: GrupoDePreparo[];
}

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' });

export function unidadesDe(unidadeVenda: UnidadeVenda, quantidade: number): number {
  return unidadeVenda === 'CENTO' ? quantidade * UNIDADES_POR_CENTO : quantidade;
}

/**
 * Monta os dois modos da produção a partir dos itens do dia. As linhas chegam
 * ordenadas por horário (sem horário no fim), número do pedido e ordem dos
 * itens; a montagem preserva essa ordem no modo cronológico.
 */
export function montarProducaoDoDia(linhas: readonly LinhaDeProducao[]): ProducaoDoDia {
  const faixas: FaixaDeHorario[] = [];
  const pedidos = new Map<string, PedidoNaProducao>();
  const consolidadas = new Map<string, LinhaConsolidada & { preparo: Preparo }>();
  const produtores = new Map<string, { produtor: Referencia; unidades: number }>();

  for (const linha of linhas) {
    const unidades = unidadesDe(linha.unidadeVenda, linha.quantidade);
    const carga = produtores.get(linha.produtor.id) ?? { produtor: linha.produtor, unidades: 0 };
    carga.unidades += unidades;
    produtores.set(linha.produtor.id, carga);

    let pedido = pedidos.get(linha.pedidoId);
    if (!pedido) {
      pedido = {
        id: linha.pedidoId,
        numero: linha.numero,
        status: linha.status,
        tipoEntrega: linha.tipoEntrega,
        observacao: linha.observacaoPedido,
        enderecoEntrega: linha.enderecoEntrega,
        cliente: linha.cliente,
        unidades: 0,
        itens: [],
      };
      pedidos.set(linha.pedidoId, pedido);
      faixaDoHorario(faixas, linha.horario).pedidos.push(pedido);
    }
    pedido.unidades += unidades;
    pedido.itens.push({
      id: linha.itemId,
      produto: linha.produto,
      produtor: linha.produtor,
      preparo: linha.preparo,
      unidadeVenda: linha.unidadeVenda,
      quantidade: linha.quantidade,
      unidades,
      observacao: linha.observacaoItem,
    });

    const chave = `${linha.preparo}|${linha.produto.id}|${linha.produtor.id}`;
    let consolidada = consolidadas.get(chave);
    if (!consolidada) {
      consolidada = {
        preparo: linha.preparo,
        produto: linha.produto,
        produtor: linha.produtor,
        unidades: 0,
        centos: 0,
        avulsas: 0,
        pedidos: [],
      };
      consolidadas.set(chave, consolidada);
    }
    consolidada.unidades += unidades;
    if (linha.unidadeVenda === 'CENTO') consolidada.centos += linha.quantidade;
    else consolidada.avulsas += linha.quantidade;
    if (!consolidada.pedidos.includes(linha.numero)) consolidada.pedidos.push(linha.numero);
  }

  for (const faixa of faixas) {
    faixa.unidades = somar(faixa.pedidos.map((pedido) => pedido.unidades));
  }
  const consolidado = agruparPorPreparo([...consolidadas.values()]);

  return {
    quantidadePedidos: pedidos.size,
    quantidadeProdutores: produtores.size,
    unidades: somar(faixas.map((faixa) => faixa.unidades)),
    porPreparo: PREPAROS.map((preparo) => ({
      preparo,
      unidades: consolidado.find((grupo) => grupo.preparo === preparo)?.unidades ?? 0,
    })),
    porProdutor: [...produtores.values()].sort(
      (a, b) =>
        b.unidades - a.unidades || ordemAlfabetica.compare(a.produtor.nome, b.produtor.nome),
    ),
    faixas,
    consolidado,
  };
}

function faixaDoHorario(faixas: FaixaDeHorario[], horario: string | null): FaixaDeHorario {
  const ultima = faixas.at(-1);
  if (ultima?.horario === horario) return ultima;
  const nova: FaixaDeHorario = { horario, unidades: 0, pedidos: [] };
  faixas.push(nova);
  return nova;
}

function agruparPorPreparo(linhas: (LinhaConsolidada & { preparo: Preparo })[]): GrupoDePreparo[] {
  return PREPAROS.flatMap((preparo) => {
    const doPreparo = linhas
      .filter((linha) => linha.preparo === preparo)
      .map(({ preparo: _preparo, ...linha }) => ({
        ...linha,
        pedidos: linha.pedidos.toSorted((a, b) => a - b),
      }))
      .sort(
        (a, b) =>
          b.unidades - a.unidades ||
          ordemAlfabetica.compare(a.produto.nome, b.produto.nome) ||
          ordemAlfabetica.compare(a.produtor.nome, b.produtor.nome),
      );
    if (doPreparo.length === 0) return [];
    return [
      { preparo, unidades: somar(doPreparo.map((linha) => linha.unidades)), linhas: doPreparo },
    ];
  });
}

function somar(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}
