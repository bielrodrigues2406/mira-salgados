import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, type Repository, type SelectQueryBuilder } from 'typeorm';

import { Paginated } from '../common/pagination/pagination.js';
import { type Centavos, decimalParaCentavos, ZERO_CENTAVOS } from '../common/utils/dinheiro.js';
import { escaparLike } from '../common/utils/like.js';
import { AgregadoPedidoService, type PedidoAgregado } from './agregado-pedido.js';
import { resumoDeTotais } from './dominio/calculos.js';
import { FORMAS_LIQUIDAS, STATUS_EM_VIGOR } from './dominio/enums.js';
import type { FiltroPedidosDto } from './dto/filtro-pedidos.dto.js';
import type { PedidoComTotais } from './dto/pedido-resumo.dto.js';
import { ItemPedido } from './itens/item-pedido.entity.js';
import { Pagamento } from './pagamentos/pagamento.entity.js';
import { Pedido } from './pedido.entity.js';

const NUMERO_DO_PEDIDO = /^#?(\d{1,9})$/;

interface SomaDeItens {
  pedidoId: string;
  subtotal: string;
  quantidade: string;
}

interface SomaDePagamentos {
  pedidoId: string;
  pago: string;
  fiado: string;
}

@Injectable()
export class PedidosConsultaService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Pedido)
    private readonly pedidos: Repository<Pedido>,
    private readonly agregados: AgregadoPedidoService,
  ) {}

  detalhar(id: string): Promise<PedidoAgregado> {
    return this.agregados.carregar(this.dataSource.manager, id);
  }

  async listar(filtro: FiltroPedidosDto): Promise<Paginated<PedidoComTotais>> {
    const direcao = filtro.ordem === 'desc' ? 'DESC' : 'ASC';
    const consulta = this.pedidos
      .createQueryBuilder('pedido')
      .innerJoinAndSelect('pedido.cliente', 'cliente')
      .orderBy('pedido.dataEntrega', direcao)
      .addOrderBy('pedido.horarioEntrega', direcao, 'NULLS LAST')
      .addOrderBy('pedido.numero', direcao)
      .skip(filtro.skip)
      .take(filtro.pageSize);
    aplicarFiltros(consulta, filtro);

    const [pedidos, total] = await consulta.getManyAndCount();
    return Paginated.of(await this.comTotais(pedidos), total, filtro);
  }

  // Somas de itens e pagamentos da página inteira em duas consultas agrupadas,
  // em vez de carregar os itens de cada pedido.
  private async comTotais(pedidos: Pedido[]): Promise<PedidoComTotais[]> {
    const ids = pedidos.map((pedido) => pedido.id);
    if (ids.length === 0) return [];

    const [itens, pagamentos] = await Promise.all([
      this.dataSource
        .createQueryBuilder(ItemPedido, 'item')
        .select('item.pedidoId', 'pedidoId')
        .addSelect('SUM(item.quantidade * item.precoUnitario)', 'subtotal')
        .addSelect('COUNT(*)', 'quantidade')
        .where({ pedidoId: In(ids) })
        .groupBy('item.pedidoId')
        .getRawMany<SomaDeItens>(),
      this.dataSource
        .createQueryBuilder(Pagamento, 'pagamento')
        .select('pagamento.pedidoId', 'pedidoId')
        .addSelect(
          'COALESCE(SUM(pagamento.valor) FILTER (WHERE pagamento.forma IN (:...liquidas)), 0)',
          'pago',
        )
        .addSelect(
          "COALESCE(SUM(pagamento.valor) FILTER (WHERE pagamento.forma = 'FIADO'), 0)",
          'fiado',
        )
        .where({ pedidoId: In(ids) })
        .andWhere('pagamento.estornadoEm IS NULL')
        .setParameter('liquidas', FORMAS_LIQUIDAS)
        .groupBy('pagamento.pedidoId')
        .getRawMany<SomaDePagamentos>(),
    ]);

    const somaDeItens = new Map(itens.map((soma) => [soma.pedidoId, soma]));
    const somaDePagamentos = new Map(pagamentos.map((soma) => [soma.pedidoId, soma]));
    return pedidos.map((pedido) => {
      const doPedido = somaDeItens.get(pedido.id);
      const pago = somaDePagamentos.get(pedido.id);
      return {
        pedido,
        quantidadeItens: Number(doPedido?.quantidade ?? 0),
        resumo: resumoDeTotais({
          subtotal: centavosOuZero(doPedido?.subtotal),
          desconto: pedido.desconto,
          totalPago: centavosOuZero(pago?.pago),
          totalFiado: centavosOuZero(pago?.fiado),
        }),
      };
    });
  }
}

function centavosOuZero(decimal: string | undefined): Centavos {
  return decimal === undefined ? ZERO_CENTAVOS : decimalParaCentavos(decimal);
}

function aplicarFiltros(consulta: SelectQueryBuilder<Pedido>, filtro: FiltroPedidosDto): void {
  if (filtro.status?.length) consulta.andWhere({ status: In(filtro.status) });
  if (filtro.clienteId) consulta.andWhere({ clienteId: filtro.clienteId });
  if (filtro.de) consulta.andWhere('pedido.dataEntrega >= :de', { de: filtro.de });
  if (filtro.ate) consulta.andWhere('pedido.dataEntrega <= :ate', { ate: filtro.ate });
  if (filtro.faltaPagar) {
    // A mesma conta do saldo devedor: itens menos desconto menos PIX e dinheiro.
    consulta.andWhere({ status: In(STATUS_EM_VIGOR) }).andWhere(
      `(SELECT COALESCE(SUM(i.quantidade * i.preco_unitario), 0)
          FROM itens_pedido i WHERE i.pedido_id = pedido.id)
        - pedido.desconto
        - (SELECT COALESCE(SUM(g.valor), 0) FROM pagamentos g
            WHERE g.pedido_id = pedido.id AND g.estornado_em IS NULL
              AND g.forma IN (:...liquidasDoSaldo)) > 0`,
      { liquidasDoSaldo: FORMAS_LIQUIDAS },
    );
  }

  const termo = filtro.busca;
  if (termo) {
    const numero = NUMERO_DO_PEDIDO.exec(termo)?.[1];
    consulta.andWhere(
      new Brackets((grupo) => {
        grupo.where(
          "lower(immutable_unaccent(cliente.nome)) LIKE lower(immutable_unaccent(:nome)) ESCAPE '\\'",
          { nome: `%${escaparLike(termo)}%` },
        );
        if (numero) grupo.orWhere('pedido.numero = :numero', { numero: Number(numero) });
      }),
    );
  }
}
