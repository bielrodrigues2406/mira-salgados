import {
  type Centavos,
  multiplicar,
  ratearCentavos,
  somar,
  subtrair,
  ZERO_CENTAVOS,
} from '../../common/utils/dinheiro.js';
import { PREPAROS, type Preparo, type UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import { unidadesDe } from '../producao/producao-do-dia.js';

interface Referencia {
  id: string;
  nome: string;
}

/** Item de um pedido em vigor na data. Os itens chegam agrupados por pedido, em ordem estável. */
export interface ItemDoAcerto {
  pedidoId: string;
  numero: number;
  descontoDoPedido: Centavos;
  produto: Referencia;
  produtor: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  precoUnitario: Centavos;
}

/** Pagamentos ativos (não estornados) de um pedido, somados por forma. */
export interface PagamentosDoPedido {
  pedidoId: string;
  pix: Centavos;
  dinheiro: Centavos;
  fiado: Centavos;
}

export interface LinhaDoProdutor {
  produto: Referencia;
  preparo: Preparo;
  centos: number;
  avulsas: number;
  /** Quantidade vezes preço, antes do desconto. */
  valor: Centavos;
}

export interface ParteDoProdutor {
  produtor: Referencia;
  unidades: number;
  itens: LinhaDoProdutor[];
  valorItens: Centavos;
  /** Parte dos descontos dos pedidos que cabe aos itens deste produtor. */
  desconto: Centavos;
  /** O que cabe ao produtor por estes salgados: itens menos a parte dos descontos. */
  valorProduzido: Centavos;
}

export interface AcertoDiario {
  quantidadePedidos: number;
  unidades: number;
  /** Soma dos totais dos pedidos: itens menos descontos. */
  valorMovimentado: Centavos;
  caixa: { pix: Centavos; dinheiro: Centavos; total: Centavos };
  fiado: { valor: Centavos; pedidos: number[] };
  semPagamento: { valor: Centavos; pedidos: number[] };
  /** Igual ao valor movimentado: o desconto sai do valor produzido de cada item. */
  totalProduzido: Centavos;
  produtores: ParteDoProdutor[];
}

interface Acumulado {
  produtor: Referencia;
  unidades: number;
  linhas: Map<string, LinhaDoProdutor>;
  valorItens: Centavos;
  valorProduzido: Centavos;
}

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Acerto de uma data (decisões D1, D2 e D3, revistas em ADR 0017):
 *
 * - o que entrou: DINHEIRO e PIX dos pedidos da data; fiado e o que falta
 *   pagar aparecem à parte;
 * - o que cada produtor tem a receber: os itens dele nos pedidos da data, cada
 *   um com a sua parte do desconto do pedido (maior resto, por pedido). Não há
 *   divisão do caixa: o que já foi entregue a cada um são os repasses.
 */
export function calcularAcerto(
  itens: readonly ItemDoAcerto[],
  pagamentos: readonly PagamentosDoPedido[],
): AcertoDiario {
  const porPedido = Map.groupBy(itens, (item) => item.pedidoId);
  const pagamentosPorPedido = new Map(pagamentos.map((soma) => [soma.pedidoId, soma]));
  const acumulados = new Map<string, Acumulado>();

  let valorMovimentado = ZERO_CENTAVOS;
  let pix = ZERO_CENTAVOS;
  let dinheiro = ZERO_CENTAVOS;
  const fiado = { valor: ZERO_CENTAVOS, pedidos: [] as number[] };
  const semPagamento = { valor: ZERO_CENTAVOS, pedidos: [] as number[] };
  let unidades = 0;

  for (const [pedidoId, doPedido] of porPedido) {
    const primeiro = doPedido[0];
    if (!primeiro) continue;
    const subtotais = doPedido.map((item) => multiplicar(item.precoUnitario, item.quantidade));
    const descontos = ratearCentavos(primeiro.descontoDoPedido, subtotais);
    const total = subtrair(somar(...subtotais), primeiro.descontoDoPedido);
    valorMovimentado = somar(valorMovimentado, total);

    doPedido.forEach((item, indice) => {
      const valor = subtotais[indice] ?? ZERO_CENTAVOS;
      const desconto = descontos[indice] ?? ZERO_CENTAVOS;
      unidades += unidadesDe(item.unidadeVenda, item.quantidade);
      acumular(acumulados, item, valor, subtrair(valor, desconto));
    });

    const pago = pagamentosPorPedido.get(pedidoId);
    const liquido = somar(pago?.pix ?? ZERO_CENTAVOS, pago?.dinheiro ?? ZERO_CENTAVOS);
    pix = somar(pix, pago?.pix ?? ZERO_CENTAVOS);
    dinheiro = somar(dinheiro, pago?.dinheiro ?? ZERO_CENTAVOS);
    const fiadoDoPedido = pago?.fiado ?? ZERO_CENTAVOS;
    if (fiadoDoPedido > 0) {
      fiado.valor = somar(fiado.valor, fiadoDoPedido);
      fiado.pedidos.push(primeiro.numero);
    }
    const aberto = subtrair(subtrair(total, liquido), fiadoDoPedido);
    if (aberto > 0) {
      semPagamento.valor = somar(semPagamento.valor, aberto);
      semPagamento.pedidos.push(primeiro.numero);
    }
  }

  const caixa = { pix, dinheiro, total: somar(pix, dinheiro) };
  const produtores = ordenar([...acumulados.values()]);
  return {
    quantidadePedidos: porPedido.size,
    unidades,
    valorMovimentado,
    caixa,
    fiado: { valor: fiado.valor, pedidos: fiado.pedidos.toSorted((a, b) => a - b) },
    semPagamento: {
      valor: semPagamento.valor,
      pedidos: semPagamento.pedidos.toSorted((a, b) => a - b),
    },
    totalProduzido: somar(...produtores.map((parte) => parte.valorProduzido)),
    produtores,
  };
}

function acumular(
  acumulados: Map<string, Acumulado>,
  item: ItemDoAcerto,
  valor: Centavos,
  valorLiquido: Centavos,
): void {
  let acumulado = acumulados.get(item.produtor.id);
  if (!acumulado) {
    acumulado = {
      produtor: item.produtor,
      unidades: 0,
      linhas: new Map(),
      valorItens: ZERO_CENTAVOS,
      valorProduzido: ZERO_CENTAVOS,
    };
    acumulados.set(item.produtor.id, acumulado);
  }
  acumulado.unidades += unidadesDe(item.unidadeVenda, item.quantidade);
  acumulado.valorItens = somar(acumulado.valorItens, valor);
  acumulado.valorProduzido = somar(acumulado.valorProduzido, valorLiquido);

  const chave = `${item.produto.id}|${item.preparo}`;
  const linha = acumulado.linhas.get(chave) ?? {
    produto: item.produto,
    preparo: item.preparo,
    centos: 0,
    avulsas: 0,
    valor: ZERO_CENTAVOS,
  };
  if (item.unidadeVenda === 'CENTO') linha.centos += item.quantidade;
  else linha.avulsas += item.quantidade;
  linha.valor = somar(linha.valor, valor);
  acumulado.linhas.set(chave, linha);
}

// Quem fez mais primeiro; empate em ordem alfabética, para o resultado não
// depender da ordem em que os itens chegaram do banco.
function ordenar(acumulados: Acumulado[]): ParteDoProdutor[] {
  return acumulados
    .toSorted(
      (a, b) =>
        b.valorProduzido - a.valorProduzido ||
        ordemAlfabetica.compare(a.produtor.nome, b.produtor.nome),
    )
    .map((acumulado) => ({
      produtor: acumulado.produtor,
      unidades: acumulado.unidades,
      itens: [...acumulado.linhas.values()].sort(
        (a, b) =>
          b.valor - a.valor ||
          ordemAlfabetica.compare(a.produto.nome, b.produto.nome) ||
          PREPAROS.indexOf(a.preparo) - PREPAROS.indexOf(b.preparo),
      ),
      valorItens: acumulado.valorItens,
      desconto: subtrair(acumulado.valorItens, acumulado.valorProduzido),
      valorProduzido: acumulado.valorProduzido,
    }));
}
