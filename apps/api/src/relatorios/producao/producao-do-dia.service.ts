import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  STATUS_EM_VIGOR,
  type StatusPedido,
  type TipoEntrega,
} from '../../pedidos/dominio/enums.js';
import { ItemPedido } from '../../pedidos/itens/item-pedido.entity.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import {
  type LinhaDeProducao,
  montarProducaoDoDia,
  type ProducaoDoDia,
} from './producao-do-dia.js';
import {
  type ItemDoIntervalo,
  montarProducaoPorDia,
  type ProducaoPorDia,
} from './producao-por-dia.js';

interface LinhaCrua {
  pedidoId: string;
  numero: number;
  status: StatusPedido;
  horario: string | null;
  tipoEntrega: TipoEntrega;
  observacaoPedido: string | null;
  enderecoEntrega: string | null;
  clienteId: string;
  clienteNome: string;
  itemId: string;
  produtoId: string;
  produtoNome: string;
  produtorId: string;
  produtorNome: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  observacaoItem: string | null;
}

@Injectable()
export class ProducaoDoDiaService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Itens dos pedidos confirmados e concluídos com entrega na data. Rascunho
   * ainda não é encomenda e cancelado não se produz. Um dia tem dezenas de
   * itens, não milhares: a montagem dos dois modos é feita em memória.
   */
  async doDia(data: string): Promise<ProducaoDoDia> {
    const linhas = await this.dataSource
      .createQueryBuilder(ItemPedido, 'item')
      .innerJoin('item.pedido', 'pedido')
      .innerJoin('pedido.cliente', 'cliente')
      .innerJoin('item.produto', 'produto')
      .innerJoin('item.produtor', 'produtor')
      .select('pedido.id', 'pedidoId')
      .addSelect('pedido.numero', 'numero')
      .addSelect('pedido.status', 'status')
      .addSelect("to_char(pedido.horarioEntrega, 'HH24:MI')", 'horario')
      .addSelect('pedido.tipoEntrega', 'tipoEntrega')
      .addSelect('pedido.observacao', 'observacaoPedido')
      .addSelect('pedido.enderecoEntrega', 'enderecoEntrega')
      .addSelect('cliente.id', 'clienteId')
      .addSelect('cliente.nome', 'clienteNome')
      .addSelect('item.id', 'itemId')
      .addSelect('produto.id', 'produtoId')
      .addSelect('produto.nome', 'produtoNome')
      .addSelect('produtor.id', 'produtorId')
      .addSelect('produtor.nome', 'produtorNome')
      .addSelect('item.preparo', 'preparo')
      .addSelect('item.unidadeVenda', 'unidadeVenda')
      .addSelect('item.quantidade', 'quantidade')
      .addSelect('item.observacao', 'observacaoItem')
      .where('pedido.dataEntrega = :data', { data })
      .andWhere('pedido.status IN (:...status)', { status: STATUS_EM_VIGOR })
      .orderBy('pedido.horarioEntrega', 'ASC', 'NULLS LAST')
      .addOrderBy('pedido.numero', 'ASC')
      // Enum ordenado pela declaração: frito, assado, congelado.
      .addOrderBy('item.preparo', 'ASC')
      .addOrderBy('produto.nome', 'ASC')
      .addOrderBy('item.criadoEm', 'ASC')
      .getRawMany<LinhaCrua>();

    return montarProducaoDoDia(linhas.map(paraLinhaDeProducao));
  }

  /** Carga de cada produtor por dia, no intervalo; com produtor, só a dele. */
  async porDia(de: string, ate: string, produtorId?: string): Promise<ProducaoPorDia> {
    const consulta = this.dataSource
      .createQueryBuilder(ItemPedido, 'item')
      .innerJoin('item.pedido', 'pedido')
      .innerJoin('item.produto', 'produto')
      .innerJoin('item.produtor', 'produtor')
      .select("to_char(pedido.dataEntrega, 'YYYY-MM-DD')", 'data')
      .addSelect('pedido.id', 'pedidoId')
      .addSelect('produto.id', 'produtoId')
      .addSelect('produto.nome', 'produtoNome')
      .addSelect('produtor.id', 'produtorId')
      .addSelect('produtor.nome', 'produtorNome')
      .addSelect('item.preparo', 'preparo')
      .addSelect('item.unidadeVenda', 'unidadeVenda')
      .addSelect('item.quantidade', 'quantidade')
      .where('pedido.dataEntrega BETWEEN :de AND :ate', { de, ate })
      .andWhere('pedido.status IN (:...status)', { status: STATUS_EM_VIGOR });
    if (produtorId) consulta.andWhere('item.produtorId = :produtorId', { produtorId });

    const itens = await consulta.getRawMany<ItemCru>();
    return montarProducaoPorDia(de, ate, itens.map(paraItemDoIntervalo));
  }
}

interface ItemCru {
  data: string;
  pedidoId: string;
  produtoId: string;
  produtoNome: string;
  produtorId: string;
  produtorNome: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
}

function paraItemDoIntervalo(item: ItemCru): ItemDoIntervalo {
  return {
    data: item.data,
    pedidoId: item.pedidoId,
    produto: { id: item.produtoId, nome: item.produtoNome },
    produtor: { id: item.produtorId, nome: item.produtorNome },
    preparo: item.preparo,
    unidadeVenda: item.unidadeVenda,
    quantidade: item.quantidade,
  };
}

function paraLinhaDeProducao(linha: LinhaCrua): LinhaDeProducao {
  return {
    pedidoId: linha.pedidoId,
    numero: linha.numero,
    status: linha.status,
    horario: linha.horario,
    tipoEntrega: linha.tipoEntrega,
    observacaoPedido: linha.observacaoPedido,
    enderecoEntrega: linha.enderecoEntrega,
    cliente: { id: linha.clienteId, nome: linha.clienteNome },
    itemId: linha.itemId,
    produto: { id: linha.produtoId, nome: linha.produtoNome },
    produtor: { id: linha.produtorId, nome: linha.produtorNome },
    preparo: linha.preparo,
    unidadeVenda: linha.unidadeVenda,
    quantidade: linha.quantidade,
    observacaoItem: linha.observacaoItem,
  };
}
