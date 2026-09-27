import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.errors.js';
import { centavos, formatarReais, subtrair } from '../../common/utils/dinheiro.js';
import { AgregadoPedidoService, type PedidoAgregado, resumir } from '../agregado-pedido.js';
import type { NovoPagamentoDto } from './dto/novo-pagamento.dto.js';
import { Pagamento } from './pagamento.entity.js';

@Injectable()
export class PagamentosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly agregados: AgregadoPedidoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Dinheiro e PIX abatem o saldo e não podem passar dele: troco não é
   * pagamento. O fiado só marca o que ficou para depois (decisão D1), então
   * vale no máximo o saldo que ainda não está marcado como fiado.
   */
  registrar(pedidoId: string, dados: NovoPagamentoDto, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, pedidoId);
      if (pedido.status === 'CANCELADO') {
        throw new BusinessRuleError(
          'PEDIDO_CANCELADO',
          'Pedidos cancelados não recebem pagamentos.',
        );
      }

      const { itens, pagamentos } = await this.agregados.itensEPagamentos(manager, pedidoId);
      const resumo = resumir(pedido, itens, pagamentos);
      const valor = centavos(dados.valorCentavos);
      const limite =
        dados.forma === 'FIADO'
          ? subtrair(resumo.saldoDevedor, resumo.totalFiado)
          : resumo.saldoDevedor;
      if (valor > limite) {
        throw new BusinessRuleError(
          'PAGAMENTO_ACIMA_DO_SALDO',
          limite > 0
            ? `O valor passa do saldo em aberto (${formatarReais(limite)}).`
            : 'Não há saldo em aberto para este lançamento.',
          { limiteCentavos: Math.max(limite, 0) },
        );
      }

      const repositorio = manager.getRepository(Pagamento);
      const pagamento = await repositorio.save(
        repositorio.create({
          pedidoId,
          forma: dados.forma,
          valor,
          registradoPorId: autorId,
          estornadoEm: null,
          estornadoPorId: null,
        }),
      );
      await this.auditoria.registrar(manager, {
        entidade: 'pagamento',
        entidadeId: pagamento.id,
        acao: 'CRIACAO',
        antes: null,
        depois: pagamento,
        usuarioId: autorId,
      });
      return this.agregados.carregar(manager, pedidoId);
    });
  }

  /** Estorno lógico: o lançamento fica no histórico, fora das somas. */
  estornar(pedidoId: string, pagamentoId: string, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      await this.agregados.bloquear(manager, pedidoId);
      const repositorio = manager.getRepository(Pagamento);
      const pagamento = await repositorio.findOneBy({ id: pagamentoId, pedidoId });
      if (!pagamento) throw new NotFoundError('Pagamento');
      if (pagamento.estornadoEm !== null) {
        throw new BusinessRuleError('PAGAMENTO_ESTORNADO', 'Este pagamento já foi estornado.');
      }

      const antes = Object.assign(new Pagamento(), pagamento);
      pagamento.estornadoEm = new Date();
      pagamento.estornadoPorId = autorId;
      const salvo = await repositorio.save(pagamento);
      await this.auditoria.registrar(manager, {
        entidade: 'pagamento',
        entidadeId: pagamentoId,
        acao: 'ESTORNO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return this.agregados.carregar(manager, pedidoId);
    });
  }
}
