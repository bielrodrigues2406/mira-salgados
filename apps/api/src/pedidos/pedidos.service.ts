import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { centavos } from '../common/utils/dinheiro.js';
import {
  AgregadoPedidoService,
  garantirConsistenciaFinanceira,
  garantirEditavel,
  type PedidoAgregado,
  pagamentosAtivos,
  resumir,
} from './agregado-pedido.js';
import type { StatusPedido } from './dominio/enums.js';
import { validarCondicoesDaTransicao, validarTransicao } from './dominio/maquina-de-estados.js';
import type { AtualizarPedidoDto } from './dto/atualizar-pedido.dto.js';
import type { CriarPedidoDto } from './dto/criar-pedido.dto.js';
import { Pedido } from './pedido.entity.js';
import { garantirClienteAtivo } from './validacoes.js';

/** Alterações de dados do pedido (não de itens nem pagamentos) e de status. */
@Injectable()
export class PedidosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly agregados: AgregadoPedidoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  criar(dados: CriarPedidoDto, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      await garantirClienteAtivo(manager, dados.clienteId);

      const repositorio = manager.getRepository(Pedido);
      const pedido = repositorio.create({
        clienteId: dados.clienteId,
        usuarioId: autorId,
        status: 'RASCUNHO',
        tipoEntrega: dados.tipoEntrega,
        desconto: centavos(dados.descontoCentavos ?? 0),
        observacao: dados.observacao ?? null,
        dataEntrega: dados.dataEntrega,
        horarioEntrega: dados.horarioEntrega ?? null,
      });

      const salvo = await repositorio.save(pedido);
      await this.auditoria.registrar(manager, {
        entidade: 'pedido',
        entidadeId: salvo.id,
        acao: 'CRIACAO',
        antes: null,
        depois: salvo,
        usuarioId: autorId,
      });
      return this.agregados.carregar(manager, salvo.id);
    });
  }

  atualizar(id: string, dados: AtualizarPedidoDto, autorId: string): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, id);
      garantirEditavel(pedido);
      const antes = Object.assign(new Pedido(), pedido);

      await aplicarAlteracoes(manager, pedido, dados);

      const { itens, pagamentos } = await this.agregados.itensEPagamentos(manager, id);
      garantirConsistenciaFinanceira(pedido, resumir(pedido, itens, pagamentos));

      const salvo = await manager.getRepository(Pedido).save(pedido);
      await this.auditoria.registrar(manager, {
        entidade: 'pedido',
        entidadeId: id,
        acao: 'ATUALIZACAO',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return this.agregados.carregar(manager, id);
    });
  }

  /** Aplica a transição de status e a registra na auditoria, na mesma transação. */
  aplicarTransicaoDeStatus(
    id: string,
    novoStatus: StatusPedido,
    autorId: string,
  ): Promise<PedidoAgregado> {
    return this.dataSource.transaction(async (manager) => {
      const pedido = await this.agregados.bloquear(manager, id);
      validarTransicao(pedido.status, novoStatus);

      const { itens, pagamentos } = await this.agregados.itensEPagamentos(manager, id);
      const resumo = resumir(pedido, itens, pagamentos);
      validarCondicoesDaTransicao(novoStatus, {
        quantidadeItens: itens.length,
        pagamentosAtivos: pagamentosAtivos(pagamentos).length,
      });

      const antes = Object.assign(new Pedido(), pedido);
      pedido.status = novoStatus;
      garantirConsistenciaFinanceira(pedido, resumo);

      const salvo = await manager.getRepository(Pedido).save(pedido);
      await this.auditoria.registrar(manager, {
        entidade: 'pedido',
        entidadeId: id,
        acao: 'TRANSICAO_STATUS',
        antes,
        depois: salvo,
        usuarioId: autorId,
      });
      return this.agregados.carregar(manager, id);
    });
  }
}

async function aplicarAlteracoes(
  manager: EntityManager,
  pedido: Pedido,
  dados: AtualizarPedidoDto,
): Promise<void> {
  if (dados.clienteId !== undefined && dados.clienteId !== pedido.clienteId) {
    await garantirClienteAtivo(manager, dados.clienteId);
    pedido.clienteId = dados.clienteId;
  }
  if (dados.tipoEntrega !== undefined) pedido.tipoEntrega = dados.tipoEntrega;
  if (dados.dataEntrega !== undefined) pedido.dataEntrega = dados.dataEntrega;
  if (dados.horarioEntrega !== undefined) pedido.horarioEntrega = dados.horarioEntrega;
  if (dados.descontoCentavos !== undefined) pedido.desconto = centavos(dados.descontoCentavos);
  if (dados.observacao !== undefined) pedido.observacao = dados.observacao;
}
