import { Injectable } from '@nestjs/common';
import { DataSource, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';

import { type Centavos, decimalParaCentavos } from '../common/utils/dinheiro.js';
import { FORMAS_LIQUIDAS, STATUS_EM_VIGOR } from './dominio/enums.js';
import { Pedido } from './pedido.entity.js';

export interface SaldoDoCliente {
  saldoDevedor: Centavos;
  pedidosComSaldo: number;
  /** Algum pedido com saldo tem fiado registrado. */
  temFiado: boolean;
}

export interface PedidoComSaldo {
  id: string;
  numero: number;
  dataEntrega: string;
  saldoDevedor: Centavos;
}

interface LinhaDeSaldo {
  clienteId: string;
  saldo: string;
  pedidos: string;
  temFiado: boolean;
}

interface LinhaDePedido {
  id: string;
  numero: number;
  dataEntrega: string;
  saldo: string;
}

/**
 * Saldo devedor consolidado por cliente, calculado no banco: pedidos CONFIRMADO
 * e CONCLUIDO, total menos o pago em DINHEIRO e PIX (decisões D1 e item 7 da
 * análise). A fórmula é a mesma de dominio/calculos.ts, e um teste de
 * integração confere que as duas chegam ao mesmo valor.
 */
@Injectable()
export class SaldoDevedorService {
  constructor(private readonly dataSource: DataSource) {}

  async porCliente(clienteIds: readonly string[]): Promise<Map<string, SaldoDoCliente>> {
    if (clienteIds.length === 0) return new Map();
    const linhas = await this.dataSource
      .createQueryBuilder()
      .select('saldos.cliente_id', 'clienteId')
      .addSelect('SUM(saldos.total - saldos.pago)', 'saldo')
      .addSelect('COUNT(*)', 'pedidos')
      .addSelect('bool_or(saldos.tem_fiado)', 'temFiado')
      .from(
        (sub: SelectQueryBuilder<ObjectLiteral>) =>
          this.totaisPorPedido(sub).andWhere('pedido.cliente_id IN (:...clienteIds)'),
        'saldos',
      )
      .where('saldos.total > saldos.pago')
      .groupBy('saldos.cliente_id')
      .setParameters({ clienteIds, emVigor: STATUS_EM_VIGOR, liquidas: FORMAS_LIQUIDAS })
      .getRawMany<LinhaDeSaldo>();

    return new Map(
      linhas.map((linha) => [
        linha.clienteId,
        {
          saldoDevedor: decimalParaCentavos(linha.saldo),
          pedidosComSaldo: Number(linha.pedidos),
          temFiado: linha.temFiado,
        },
      ]),
    );
  }

  /** Pedidos do cliente que ainda têm saldo, dos mais antigos aos mais novos. */
  async pedidosEmAberto(clienteId: string, limite: number): Promise<PedidoComSaldo[]> {
    const linhas = await this.dataSource
      .createQueryBuilder()
      .select('saldos.id', 'id')
      .addSelect('saldos.numero', 'numero')
      // Colunas date chegam do driver como Date no fuso local; em texto não há fuso.
      .addSelect("to_char(saldos.data_entrega, 'YYYY-MM-DD')", 'dataEntrega')
      .addSelect('saldos.total - saldos.pago', 'saldo')
      .from(
        (sub: SelectQueryBuilder<ObjectLiteral>) =>
          this.totaisPorPedido(sub).andWhere('pedido.cliente_id = :clienteId'),
        'saldos',
      )
      .where('saldos.total > saldos.pago')
      .orderBy('saldos.data_entrega', 'ASC')
      .addOrderBy('saldos.numero', 'ASC')
      .limit(limite)
      .setParameters({ clienteId, emVigor: STATUS_EM_VIGOR, liquidas: FORMAS_LIQUIDAS })
      .getRawMany<LinhaDePedido>();

    return linhas.map((linha) => ({
      id: linha.id,
      numero: linha.numero,
      dataEntrega: linha.dataEntrega,
      saldoDevedor: decimalParaCentavos(linha.saldo),
    }));
  }

  private totaisPorPedido(
    sub: SelectQueryBuilder<ObjectLiteral>,
  ): SelectQueryBuilder<ObjectLiteral> {
    return sub
      .select('pedido.id', 'id')
      .addSelect('pedido.numero', 'numero')
      .addSelect('pedido.cliente_id', 'cliente_id')
      .addSelect('pedido.data_entrega', 'data_entrega')
      .addSelect(
        `COALESCE((SELECT SUM(ROUND(item.quantidade * item.preco_unitario, 2)) FROM itens_pedido item
          WHERE item.pedido_id = pedido.id), 0) - pedido.desconto`,
        'total',
      )
      .addSelect(
        `COALESCE((SELECT SUM(pag.valor) FROM pagamentos pag WHERE pag.pedido_id = pedido.id
          AND pag.estornado_em IS NULL AND pag.forma IN (:...liquidas)), 0)`,
        'pago',
      )
      .addSelect(
        `EXISTS (SELECT 1 FROM pagamentos pag WHERE pag.pedido_id = pedido.id
          AND pag.estornado_em IS NULL AND pag.forma = 'FIADO')`,
        'tem_fiado',
      )
      .from(Pedido, 'pedido')
      .where('pedido.status IN (:...emVigor)');
  }
}
