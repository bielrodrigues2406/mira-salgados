import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import { decimalParaCentavos } from '../../common/utils/dinheiro.js';
import { STATUS_EM_VIGOR } from '../../pedidos/dominio/enums.js';
import { ItemPedido } from '../../pedidos/itens/item-pedido.entity.js';
import { Pagamento } from '../../pedidos/pagamentos/pagamento.entity.js';
import type { Preparo, UnidadeVenda } from '../../produtos/preco-produto.entity.js';
import {
  type AcertoDiario,
  calcularAcerto,
  type ItemDoAcerto,
  type PagamentosDoPedido,
} from './acerto-diario.js';

interface ItemCru {
  pedidoId: string;
  numero: number;
  desconto: string;
  produtoId: string;
  produtoNome: string;
  produtorId: string;
  produtorNome: string;
  preparo: Preparo;
  unidadeVenda: UnidadeVenda;
  quantidade: number;
  precoUnitario: string;
}

interface PagamentosCrus {
  pedidoId: string;
  pix: string;
  dinheiro: string;
  fiado: string;
}

@Injectable()
export class AcertoDiarioService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Pedidos confirmados e concluídos com entrega na data, com os pagamentos
   * que tiverem, registrados em qualquer dia (decisão D2). Os valores chegam
   * do banco como texto e viram centavos antes de qualquer conta.
   */
  async daData(data: string): Promise<AcertoDiario> {
    const itens = await this.dataSource
      .createQueryBuilder(ItemPedido, 'item')
      .innerJoin('item.pedido', 'pedido')
      .innerJoin('item.produto', 'produto')
      .innerJoin('item.produtor', 'produtor')
      .select('pedido.id', 'pedidoId')
      .addSelect('pedido.numero', 'numero')
      .addSelect('pedido.desconto', 'desconto')
      .addSelect('produto.id', 'produtoId')
      .addSelect('produto.nome', 'produtoNome')
      .addSelect('produtor.id', 'produtorId')
      .addSelect('produtor.nome', 'produtorNome')
      .addSelect('item.preparo', 'preparo')
      .addSelect('item.unidadeVenda', 'unidadeVenda')
      .addSelect('item.quantidade', 'quantidade')
      .addSelect('item.precoUnitario', 'precoUnitario')
      .where('pedido.dataEntrega = :data', { data })
      .andWhere('pedido.status IN (:...status)', { status: STATUS_EM_VIGOR })
      // Ordem estável: o desempate do rateio do desconto não pode variar.
      .orderBy('pedido.numero', 'ASC')
      .addOrderBy('item.criadoEm', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .getRawMany<ItemCru>();

    const pedidoIds = [...new Set(itens.map((item) => item.pedidoId))];
    const pagamentos =
      pedidoIds.length === 0
        ? []
        : await this.dataSource
            .createQueryBuilder(Pagamento, 'pagamento')
            .select('pagamento.pedidoId', 'pedidoId')
            .addSelect(
              "COALESCE(SUM(pagamento.valor) FILTER (WHERE pagamento.forma = 'PIX'), 0)",
              'pix',
            )
            .addSelect(
              "COALESCE(SUM(pagamento.valor) FILTER (WHERE pagamento.forma = 'DINHEIRO'), 0)",
              'dinheiro',
            )
            .addSelect(
              "COALESCE(SUM(pagamento.valor) FILTER (WHERE pagamento.forma = 'FIADO'), 0)",
              'fiado',
            )
            .where({ pedidoId: In(pedidoIds) })
            .andWhere('pagamento.estornadoEm IS NULL')
            .groupBy('pagamento.pedidoId')
            .getRawMany<PagamentosCrus>();

    return calcularAcerto(itens.map(paraItemDoAcerto), pagamentos.map(paraPagamentos));
  }
}

function paraItemDoAcerto(item: ItemCru): ItemDoAcerto {
  return {
    pedidoId: item.pedidoId,
    numero: item.numero,
    descontoDoPedido: decimalParaCentavos(item.desconto),
    produto: { id: item.produtoId, nome: item.produtoNome },
    produtor: { id: item.produtorId, nome: item.produtorNome },
    preparo: item.preparo,
    unidadeVenda: item.unidadeVenda,
    quantidade: item.quantidade,
    precoUnitario: decimalParaCentavos(item.precoUnitario),
  };
}

function paraPagamentos(soma: PagamentosCrus): PagamentosDoPedido {
  return {
    pedidoId: soma.pedidoId,
    pix: decimalParaCentavos(soma.pix),
    dinheiro: decimalParaCentavos(soma.dinheiro),
    fiado: decimalParaCentavos(soma.fiado),
  };
}
