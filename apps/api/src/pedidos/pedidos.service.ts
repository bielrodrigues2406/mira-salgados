import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ConflictError } from '../common/errors/domain.errors.js';
import { ehViolacaoDeUnicidade } from '../common/errors/postgres-errors.js';
import { centavos } from '../common/utils/dinheiro.js';
import {
  AgregadoPedidoService,
  garantirConsistenciaFinanceira,
  garantirEditavel,
  type PedidoAgregado,
  pagamentosAtivos,
  resumir,
} from './agregado-pedido.js';
import { ChaveIdempotencia, RESTRICAO_CHAVE_IDEMPOTENCIA } from './chave-idempotencia.entity.js';
import { resumoFinanceiro } from './dominio/calculos.js';
import type { StatusPedido } from './dominio/enums.js';
import { hashCanonicaRequisicao, normalizarChaveIdempotencia } from './dominio/idempotencia.js';
import { validarCondicoesDaTransicao, validarTransicao } from './dominio/maquina-de-estados.js';
import type { AtualizarPedidoDto } from './dto/atualizar-pedido.dto.js';
import type { CriarPedidoConfirmadoDto } from './dto/criar-pedido-confirmado.dto.js';
import type { CriarPedidoDto } from './dto/criar-pedido.dto.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { ItemPedido } from './itens/item-pedido.entity.js';
import { type ItemResolvido, resolverItemParaPedido } from './itens/resolver-item.js';
import { Pedido } from './pedido.entity.js';
import { garantirClienteAtivo } from './validacoes.js';

const ROTA_PEDIDOS_CONFIRMADOS = 'POST /pedidos/confirmados';
const TTL_CHAVE_IDEMPOTENCIA_MS = 72 * 60 * 60 * 1000;

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
      const cliente = await garantirClienteAtivo(manager, dados.clienteId);

      const repositorio = manager.getRepository(Pedido);
      const pedido = repositorio.create({
        clienteId: dados.clienteId,
        usuarioId: autorId,
        status: 'RASCUNHO',
        tipoEntrega: dados.tipoEntrega,
        desconto: centavos(dados.descontoCentavos ?? 0),
        observacao: dados.observacao ?? null,
        enderecoEntrega:
          dados.tipoEntrega === 'ENTREGA'
            ? dados.enderecoEntrega === undefined
              ? cliente.endereco
              : dados.enderecoEntrega
            : null,
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

  /**
   * Cria encomenda já confirmada com seus itens e auditoria numa única
   * transação. Valida todos os dados antes do INSERT do pedido para não
   * queimar números sequenciais em entradas inválidas. Com `Idempotency-Key`,
   * protege contra duplo clique e retentativas de rede.
   */
  async criarConfirmado(
    dados: CriarPedidoConfirmadoDto,
    autorId: string,
    chaveBruta?: string,
  ): Promise<PedidoAgregado> {
    const chave = normalizarChaveIdempotencia(chaveBruta);
    const hash = chave ? hashCanonicaRequisicao(dados) : undefined;

    if (chave && hash) {
      const repetido = await this.resolverIdempotenciaExistente(
        this.dataSource.manager,
        autorId,
        chave,
        hash,
      );
      if (repetido) return repetido;
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        if (chave && hash) {
          const repetido = await this.resolverIdempotenciaExistente(manager, autorId, chave, hash);
          if (repetido) return repetido;
        }

        const cliente = await garantirClienteAtivo(manager, dados.clienteId);
        const itensResolvidos: ItemResolvido[] = [];
        for (const itemDto of dados.itens) {
          itensResolvidos.push(await resolverItemParaPedido(manager, itemDto));
        }

        const desconto = centavos(dados.descontoCentavos ?? 0);
        const resumo = resumoFinanceiro(itensResolvidos, desconto, []);
        garantirConsistenciaFinanceira({ status: 'CONFIRMADO' }, resumo);

        const repoPedido = manager.getRepository(Pedido);
        const pedido = await repoPedido.save(
          repoPedido.create({
            clienteId: dados.clienteId,
            usuarioId: autorId,
            status: 'CONFIRMADO',
            tipoEntrega: dados.tipoEntrega,
            desconto,
            observacao: dados.observacao ?? null,
            enderecoEntrega:
              dados.tipoEntrega === 'ENTREGA'
                ? dados.enderecoEntrega === undefined
                  ? cliente.endereco
                  : dados.enderecoEntrega
                : null,
            dataEntrega: dados.dataEntrega,
            horarioEntrega: dados.horarioEntrega ?? null,
          }),
        );

        await this.auditoria.registrar(manager, {
          entidade: 'pedido',
          entidadeId: pedido.id,
          acao: 'CRIACAO',
          antes: null,
          depois: pedido,
          usuarioId: autorId,
        });

        const repoItem = manager.getRepository(ItemPedido);
        for (const resolvido of itensResolvidos) {
          const item = await repoItem.save(repoItem.create({ pedidoId: pedido.id, ...resolvido }));
          await this.auditoria.registrar(manager, {
            entidade: 'item_pedido',
            entidadeId: item.id,
            acao: 'CRIACAO',
            antes: null,
            depois: item,
            usuarioId: autorId,
          });
        }

        if (chave && hash) {
          const repoChave = manager.getRepository(ChaveIdempotencia);
          await repoChave.save(
            repoChave.create({
              usuarioId: autorId,
              rota: ROTA_PEDIDOS_CONFIRMADOS,
              chave,
              hashRequisicao: hash,
              pedidoId: pedido.id,
              expiraEm: new Date(Date.now() + TTL_CHAVE_IDEMPOTENCIA_MS),
            }),
          );
        }

        return this.agregados.carregar(manager, pedido.id);
      });
    } catch (erro) {
      // Corrida simultânea com a mesma Idempotency-Key: a transação perdedora
      // sofre rollback e lê o pedido comitado pela vencedora (ou devolve 409).
      if (chave && hash && ehViolacaoDeUnicidade(erro, RESTRICAO_CHAVE_IDEMPOTENCIA)) {
        const existente = await this.resolverIdempotenciaExistente(
          this.dataSource.manager,
          autorId,
          chave,
          hash,
        );
        if (existente) return existente;
      }
      throw erro;
    }
  }

  private async resolverIdempotenciaExistente(
    manager: EntityManager,
    usuarioId: string,
    chave: string,
    hash: string,
  ): Promise<PedidoAgregado | null> {
    const existente = await manager.getRepository(ChaveIdempotencia).findOneBy({
      usuarioId,
      rota: ROTA_PEDIDOS_CONFIRMADOS,
      chave,
    });
    if (!existente) return null;
    if (existente.hashRequisicao !== hash) {
      throw new ConflictError(
        'CHAVE_IDEMPOTENCIA_CONFLITANTE',
        'Esta tentativa já foi usada com outros dados de encomenda. Envie novamente com uma nova chave.',
      );
    }
    return this.agregados.carregar(manager, existente.pedidoId);
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
  if (dados.enderecoEntrega !== undefined) pedido.enderecoEntrega = dados.enderecoEntrega;
  // Retirada não tem endereço; entrega sem endereço informado herda o do cliente.
  if (pedido.tipoEntrega === 'RETIRADA') {
    pedido.enderecoEntrega = null;
  } else if (dados.enderecoEntrega === undefined && pedido.enderecoEntrega === null) {
    const cliente = await manager.getRepository(Cliente).findOneBy({ id: pedido.clienteId });
    pedido.enderecoEntrega = cliente?.endereco ?? null;
  }
  if (dados.dataEntrega !== undefined) pedido.dataEntrega = dados.dataEntrega;
  if (dados.horarioEntrega !== undefined) pedido.horarioEntrega = dados.horarioEntrega;
  if (dados.descontoCentavos !== undefined) pedido.desconto = centavos(dados.descontoCentavos);
  if (dados.observacao !== undefined) pedido.observacao = dados.observacao;
}
