import { diasDoIntervalo } from '../../common/utils/datas.js';
import { PREPAROS, type Preparo, type UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import { unidadesDe } from './producao-do-dia.js';

interface Referencia {
  id: string;
  nome: string;
}

/** Um item de pedido em vigor no intervalo. */
export interface ItemDoIntervalo {
  data: string;
  pedidoId: string;
  produto: Referencia;
  produtor: Referencia;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
}

export interface SalgadoDoProdutor {
  produto: Referencia;
  preparo: Preparo;
  unidades: number;
}

export interface ProdutorNoDia {
  produtor: Referencia;
  unidades: number;
  /** Do mais feito para o menos feito. */
  salgados: SalgadoDoProdutor[];
}

export interface DiaDeProducao {
  data: string;
  quantidadePedidos: number;
  unidades: number;
  /** Da maior carga para a menor. */
  produtores: ProdutorNoDia[];
}

export interface ProducaoPorDia {
  unidades: number;
  /** Todos os dias do intervalo, em ordem, inclusive os sem produção. */
  dias: DiaDeProducao[];
}

const ordemAlfabetica = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Quanto cada produtor faz em cada dia, por salgado. É a visão da semana:
 * sem pedidos nem horários, que ficam na produção do dia.
 */
export function montarProducaoPorDia(
  de: string,
  ate: string,
  itens: readonly ItemDoIntervalo[],
): ProducaoPorDia {
  const porData = Map.groupBy(itens, (item) => item.data);
  const dias = diasDoIntervalo(de, ate).map((data) => montarDia(data, porData.get(data) ?? []));
  return { unidades: dias.reduce((soma, dia) => soma + dia.unidades, 0), dias };
}

function montarDia(data: string, itens: readonly ItemDoIntervalo[]): DiaDeProducao {
  const produtores = new Map<
    string,
    { produtor: Referencia; salgados: Map<string, SalgadoDoProdutor> }
  >();
  for (const item of itens) {
    let doProdutor = produtores.get(item.produtor.id);
    if (!doProdutor) {
      doProdutor = { produtor: item.produtor, salgados: new Map() };
      produtores.set(item.produtor.id, doProdutor);
    }
    const chave = `${item.produto.id}|${item.preparo}`;
    const salgado = doProdutor.salgados.get(chave) ?? {
      produto: item.produto,
      preparo: item.preparo,
      unidades: 0,
    };
    salgado.unidades += unidadesDe(item.unidadeVenda, item.quantidade);
    doProdutor.salgados.set(chave, salgado);
  }

  const cargas = [...produtores.values()]
    .map(({ produtor, salgados }): ProdutorNoDia => {
      const lista = [...salgados.values()].sort(
        (a, b) =>
          b.unidades - a.unidades ||
          ordemAlfabetica.compare(a.produto.nome, b.produto.nome) ||
          PREPAROS.indexOf(a.preparo) - PREPAROS.indexOf(b.preparo),
      );
      return {
        produtor,
        unidades: lista.reduce((soma, salgado) => soma + salgado.unidades, 0),
        salgados: lista,
      };
    })
    .sort(
      (a, b) =>
        b.unidades - a.unidades || ordemAlfabetica.compare(a.produtor.nome, b.produtor.nome),
    );

  return {
    data,
    quantidadePedidos: new Set(itens.map((item) => item.pedidoId)).size,
    unidades: cargas.reduce((soma, carga) => soma + carga.unidades, 0),
    produtores: cargas,
  };
}
