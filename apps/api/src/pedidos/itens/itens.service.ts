import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, IsNull } from 'typeorm';

import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.errors.js';
import { PrecoProduto } from '../../produtos/preco-produto.entity.js';
import { Produto } from '../../produtos/produto.entity.js';
import {
  AgregadoPedidoService,
  garantirConsistenciaFinanceira,
  garantirEditavel,
  type PedidoAgregado,
  resumir,
} from '../agregado-pedido.js';
import type { Pedido } from '../pedido.entity.js';
import { garantirProdutorAtivo } from '../validacoes.js';
import type { AtualizarItemDto } from './dto/atualizar-item.dto.js';
import type { NovoItemDto } from './dto/novo-item.dto.js';
import { ItemPedido } from './item-pedido.entity.js';

const ROTULOS = {
  FRITO: 'Frito',
  ASSADO: 'Assado',
  CONGELADO: 'Congelado',
  UNIDADE: 'Unidade',
  CENTO: 'Cento',
} as const;

@Injectable()
export class ItensService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly agregados: AgregadoPedidoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Copia para o item o preço vigente da combinação e, se nenhum produtor for
   * informado, o produtor padrão do produto. Mudanças futuras na tabela de
   * preços ou no padrão não alteram o item.
   */
  adicionar(pedidoId: string, dados: NovoItemDto, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, pedidoId);
      garantirEditavel(pedido);

      const produto = await manager.getRepository(Produto).findOneBy({ id: dados.produtoId });
      if (!produto?.ativo) {
        throw new BusinessRuleError('PRODUTO_INVALIDO', 'Escolha um produto ativo.');
      }
      const preco = await manager.getRepository(PrecoProduto).findOneBy({
        produtoId: produto.id,
        preparo: dados.preparo,
        unidadeVenda: dados.unidadeVenda,
        vigenteAte: IsNull(),
      });
      if (!preco) {
        throw new BusinessRuleError(
          'PRECO_INEXISTENTE',
          `${produto.nome} não tem preço vigente para ${ROTULOS[dados.preparo]} · ${ROTULOS[dados.unidadeVenda]}.`,
        );
      }
      const produtorId = dados.produtorId ?? produto.produtorPadraoId;
      if (dados.produtorId) await garantirProdutorAtivo(manager, dados.produtorId);

      const repositorio = manager.getRepository(ItemPedido);
      const item = await repositorio.save(
        repositorio.create({
          pedidoId,
          produtoId: produto.id,
          produtorId,
          preparo: dados.preparo,
          unidadeVenda: dados.unidadeVenda,
          quantidade: dados.quantidade,
          precoUnitario: preco.preco,
          observacao: dados.observacao ?? null,
        }),
      );
      await this.registrar(manager, 'CRIACAO', item.id, null, item, autorId);
      await this.verificarInvariantes(manager, pedido);
      return this.agregados.carregar(manager, pedidoId);
    });
  }

  atualizar(
    pedidoId: string,
    itemId: string,
    dados: AtualizarItemDto,
    autorId: string,
  ): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, pedidoId);
      garantirEditavel(pedido);
      const item = await this.buscarDoPedido(manager, pedidoId, itemId);
      const antes = Object.assign(new ItemPedido(), item);

      if (dados.quantidade !== undefined) item.quantidade = dados.quantidade;
      if (dados.produtorId !== undefined && dados.produtorId !== item.produtorId) {
        await garantirProdutorAtivo(manager, dados.produtorId);
        item.produtorId = dados.produtorId;
      }
      if (dados.observacao !== undefined) item.observacao = dados.observacao;

      const salvo = await manager.getRepository(ItemPedido).save(item);
      await this.registrar(manager, 'ATUALIZACAO', itemId, antes, salvo, autorId);
      await this.verificarInvariantes(manager, pedido);
      return this.agregados.carregar(manager, pedidoId);
    });
  }

  remover(pedidoId: string, itemId: string, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, pedidoId);
      garantirEditavel(pedido);
      const item = await this.buscarDoPedido(manager, pedidoId, itemId);

      const antes = Object.assign(new ItemPedido(), item);
      await manager.getRepository(ItemPedido).remove(item);
      await this.registrar(manager, 'EXCLUSAO', itemId, antes, null, autorId);

      const { itens } = await this.agregados.itensEPagamentos(manager, pedidoId);
      if (pedido.status === 'CONFIRMADO' && itens.length === 0) {
        throw new BusinessRuleError(
          'PEDIDO_SEM_ITENS',
          'Um pedido confirmado precisa de ao menos um item. Cancele o pedido se nada será entregue.',
        );
      }
      await this.verificarInvariantes(manager, pedido);
      return this.agregados.carregar(manager, pedidoId);
    });
  }

  private async buscarDoPedido(
    manager: EntityManager,
    pedidoId: string,
    itemId: string,
  ): Promise<ItemPedido> {
    const item = await manager.getRepository(ItemPedido).findOneBy({ id: itemId, pedidoId });
    if (!item) throw new NotFoundError('Item');
    return item;
  }

  // Depois da alteração, dentro da mesma transação: uma violação desfaz tudo.
  private async verificarInvariantes(manager: EntityManager, pedido: Pedido): Promise<void> {
    const { itens, pagamentos } = await this.agregados.itensEPagamentos(manager, pedido.id);
    garantirConsistenciaFinanceira(pedido, resumir(pedido, itens, pagamentos));
  }

  private registrar(
    manager: EntityManager,
    acao: 'CRIACAO' | 'ATUALIZACAO' | 'EXCLUSAO',
    itemId: string,
    antes: ItemPedido | null,
    depois: ItemPedido | null,
    autorId: string,
  ): Promise<void> {
    return this.auditoria.registrar(manager, {
      entidade: 'item_pedido',
      entidadeId: itemId,
      acao,
      antes,
      depois,
      usuarioId: autorId,
    });
  }
}
