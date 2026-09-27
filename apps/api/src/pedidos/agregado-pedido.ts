import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { BusinessRuleError, NotFoundError } from '../common/errors/domain.errors.js';
import { formatarReais } from '../common/utils/dinheiro.js';
import { resumoFinanceiro, type ResumoFinanceiro } from './dominio/calculos.js';
import { STATUS_EDITAVEIS } from './dominio/enums.js';
import { ItemPedido } from './itens/item-pedido.entity.js';
import { Pagamento } from './pagamentos/pagamento.entity.js';
import { Pedido } from './pedido.entity.js';

/** Pedido com itens e pagamentos (inclusive estornados), carregado de uma vez. */
export interface PedidoAgregado {
  pedido: Pedido;
  itens: ItemPedido[];
  pagamentos: Pagamento[];
}

export function pagamentosAtivos(pagamentos: readonly Pagamento[]): Pagamento[] {
  return pagamentos.filter((pagamento) => pagamento.estornadoEm === null);
}

export function resumir(
  pedido: Pick<Pedido, 'desconto' | 'taxaEntrega'>,
  itens: readonly ItemPedido[],
  pagamentos: readonly Pagamento[],
): ResumoFinanceiro {
  return resumoFinanceiro(itens, pedido.desconto, pedido.taxaEntrega, pagamentosAtivos(pagamentos));
}

export function garantirEditavel(pedido: Pedido): void {
  if (!STATUS_EDITAVEIS.includes(pedido.status)) {
    throw new BusinessRuleError(
      'PEDIDO_ENCERRADO',
      'Pedidos concluídos ou cancelados não podem ser alterados.',
      { status: pedido.status },
    );
  }
}

/**
 * Invariantes que dependem de valores: nenhuma alteração pode deixar o total
 * abaixo do que já foi pago, e num pedido confirmado o desconto não passa do
 * valor dos itens (a divisão entre produtores parte desse valor, decisão D3).
 * No rascunho o desconto pode anteceder os itens; a regra vale ao confirmar.
 */
export function garantirConsistenciaFinanceira(
  pedido: Pick<Pedido, 'status'>,
  resumo: ResumoFinanceiro,
): void {
  if (pedido.status !== 'RASCUNHO' && resumo.desconto > resumo.subtotal) {
    throw new BusinessRuleError(
      'DESCONTO_MAIOR_QUE_SUBTOTAL',
      `O desconto não pode passar do valor dos itens (${formatarReais(resumo.subtotal)}).`,
    );
  }
  // Sem pagamento, um rascunho com desconto maior que os itens ainda pode ser
  // ajustado; a regra do desconto o barra ao confirmar.
  if (resumo.totalPago > 0 && resumo.total < resumo.totalPago) {
    throw new BusinessRuleError(
      'TOTAL_MENOR_QUE_PAGO',
      `O total ficaria abaixo do que já foi pago (${formatarReais(resumo.totalPago)}). Estorne um pagamento antes.`,
    );
  }
}

@Injectable()
export class AgregadoPedidoService {
  /**
   * Bloqueia a linha do pedido até o fim da transação. Toda alteração no
   * agregado (dados, itens, pagamentos, status) passa por aqui, então as
   * invariantes são verificadas sobre um estado que ninguém muda ao mesmo tempo.
   */
  async bloquear(manager: EntityManager, id: string): Promise<Pedido> {
    const pedido = await manager.getRepository(Pedido).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    return pedido;
  }

  async carregar(manager: EntityManager, id: string): Promise<PedidoAgregado> {
    const pedido = await manager.getRepository(Pedido).findOne({
      where: { id },
      relations: { cliente: true, entregador: true, usuario: true },
    });
    if (!pedido) throw new NotFoundError('Pedido');
    return { pedido, ...(await this.itensEPagamentos(manager, id)) };
  }

  async itensEPagamentos(
    manager: EntityManager,
    pedidoId: string,
  ): Promise<Omit<PedidoAgregado, 'pedido'>> {
    const id = pedidoId;
    const [itens, pagamentos] = await Promise.all([
      manager.getRepository(ItemPedido).find({
        where: { pedidoId: id },
        relations: { produto: { produtorPadrao: true }, produtor: true },
        order: { criadoEm: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(Pagamento).find({
        where: { pedidoId: id },
        relations: { registradoPor: true, estornadoPor: true },
        order: { criadoEm: 'ASC', id: 'ASC' },
      }),
    ]);
    return { itens, pagamentos };
  }
}
