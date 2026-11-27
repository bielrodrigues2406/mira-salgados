import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, In } from 'typeorm';

import { ehViolacaoDeUnicidade } from '../../common/errors/postgres-errors.js';
import type { StatusPedido } from '../../pedidos/dominio/enums.js';
import { ItemPedido } from '../../pedidos/itens/item-pedido.entity.js';
import { Pedido } from '../../pedidos/pedido.entity.js';
import { avaliarJanelaResumo, calcularFimJanelaResumo } from '../dominio/calendario.js';
import { formatarResumoDiario, type PedidoParaResumo } from '../dominio/formatacao.js';
import { projetarPedido } from '../dominio/projecao.js';
import {
  chaveDeduplicacaoResumo,
  encomendaCorrespondeARegra,
  itensParaMensagem,
  preparosDestacadosDaRegra,
} from '../dominio/regras.js';
import {
  ExecucaoResumoDiario,
  RESTRICAO_EXECUCAO_RESUMO_UNICA,
} from '../entities/execucao-resumo-diario.entity.js';
import {
  OutboxNotificacao,
  RESTRICAO_CHAVE_DEDUPLICACAO,
} from '../entities/outbox-notificacao.entity.js';
import { RegraNotificacao } from '../entities/regra-notificacao.entity.js';
import { ResumoEnviadoPedido } from '../entities/resumo-enviado-pedido.entity.js';

export interface ResultadoAgendamentoResumos {
  agendados: number;
  expirados: number;
  omitidos: number;
}

/**
 * Avalia regras `RESUMO_DIARIO` no fuso configurado (`America/Sao_Paulo`),
 * enfileira resumos dentro da janela de recuperação e registra em
 * `resumos_enviados_pedidos` quais encomendas entraram no resumo.
 */
@Injectable()
export class AgendadorResumosService {
  constructor(private readonly dataSource: DataSource) {}

  async carregarPedidosParaResumo(
    manager: EntityManager,
    dataLocal: string,
    regra: RegraNotificacao,
  ): Promise<{ pedido: Pedido; entrada: PedidoParaResumo }[]> {
    const statusPermitidos: StatusPedido[] = regra.incluirConcluidos
      ? ['CONFIRMADO', 'CONCLUIDO']
      : ['CONFIRMADO'];

    const pedidos = await manager.getRepository(Pedido).find({
      where: { dataEntrega: dataLocal, status: In(statusPermitidos) },
      order: { horarioEntrega: 'ASC', numero: 'ASC' },
    });
    if (pedidos.length === 0) return [];

    const itens = await manager.getRepository(ItemPedido).find({
      where: { pedidoId: In(pedidos.map((pedido) => pedido.id)) },
      relations: { produto: true },
      order: { criadoEm: 'ASC', id: 'ASC' },
    });

    const itensPorPedido = new Map<string, ItemPedido[]>();
    for (const item of itens) {
      const lista = itensPorPedido.get(item.pedidoId) ?? [];
      lista.push(item);
      itensPorPedido.set(item.pedidoId, lista);
    }

    const elegiveis: { pedido: Pedido; entrada: PedidoParaResumo }[] = [];
    for (const pedido of pedidos) {
      const listaItens = itensPorPedido.get(pedido.id) ?? [];
      const projecao = projetarPedido(
        {
          id: pedido.id,
          numero: pedido.numero,
          status: pedido.status,
          dataEntrega: pedido.dataEntrega,
          horarioEntrega: pedido.horarioEntrega,
          tipoEntrega: pedido.tipoEntrega,
        },
        listaItens.map((item) => ({
          produtoId: item.produtoId,
          produtoNome: item.produto?.nome ?? 'Produto',
          preparo: item.preparo,
          unidadeVenda: item.unidadeVenda,
          quantidade: item.quantidade,
        })),
      );

      if (!encomendaCorrespondeARegra(projecao, regra)) continue;

      const itensDaMensagem = itensParaMensagem(projecao, regra);
      if (itensDaMensagem.length === 0) continue;

      elegiveis.push({
        pedido,
        entrada: { projecao, itens: itensDaMensagem },
      });
    }

    return elegiveis;
  }

  async processarResumosDoDia(agora = new Date()): Promise<ResultadoAgendamentoResumos> {
    const resultado: ResultadoAgendamentoResumos = {
      agendados: 0,
      expirados: 0,
      omitidos: 0,
    };

    const regras = await this.dataSource
      .getRepository(RegraNotificacao)
      .createQueryBuilder('regra')
      .innerJoinAndSelect('regra.destino', 'destino')
      .where('regra.tipo = :tipo', { tipo: 'RESUMO_DIARIO' })
      .andWhere('regra.ativa = true')
      .andWhere('destino.ativo = true')
      .orderBy('regra.criadoEm', 'ASC')
      .getMany();

    for (const regra of regras) {
      const { local, situacao } = avaliarJanelaResumo(agora, regra);
      if (situacao === 'FORA_DO_DIA' || situacao === 'ANTES_DO_HORARIO') continue;

      const chave = chaveDeduplicacaoResumo(regra.id, regra.destinoId, local.data);

      try {
        const desfecho = await this.dataSource.transaction(async (manager) => {
          const repoExecucao = manager.getRepository(ExecucaoResumoDiario);
          const execucaoExistente = await repoExecucao.findOneBy({
            regraId: regra.id,
            destinoId: regra.destinoId,
            dataReferencia: local.data,
          });
          if (execucaoExistente) return 'JA_EXISTE' as const;

          const existente = await manager.getRepository(OutboxNotificacao).findOneBy({
            chaveDeduplicacao: chave,
          });
          if (existente) return 'JA_EXISTE' as const;

          const elegiveis = await this.carregarPedidosParaResumo(manager, local.data, regra);
          if (elegiveis.length === 0 && regra.omitirDiasVazios) {
            // Registra que o dia vazio já foi avaliado e omitido para impedir que
            // um pedido criado depois saia duplicado (resumo tardio + complemento).
            await repoExecucao.save(
              repoExecucao.create({
                regraId: regra.id,
                destinoId: regra.destinoId,
                dataReferencia: local.data,
                desfecho: 'OMITIDO',
                outboxId: null,
              }),
            );
            return 'OMITIDO' as const;
          }

          const textoRenderizado = formatarResumoDiario(
            local.data,
            elegiveis.map((item) => item.entrada),
            { destacarPreparos: preparosDestacadosDaRegra(regra) },
          );

          const expirado = situacao === 'EXPIRADO';
          const expiraEm = expirado ? null : calcularFimJanelaResumo(agora, regra);
          const repoOutbox = manager.getRepository(OutboxNotificacao);
          const outbox = await repoOutbox.save(
            repoOutbox.create({
              chaveDeduplicacao: chave,
              tipoEvento: 'RESUMO_DIARIO',
              status: expirado ? 'EXPIRADO' : 'PENDENTE',
              regraId: regra.id,
              destinoId: regra.destinoId,
              destinoIdentificadorExterno: regra.destino?.identificadorExterno ?? null,
              pedidoId: null,
              pedidoRevisao: null,
              dataReferencia: local.data,
              textoRenderizado,
              disponivelEm: agora,
              expiraEm,
              envioIniciadoEm: null,
              reservadoAte: null,
              reservadoPor: null,
              tentativas: 0,
              maxTentativas: 5,
              idExterno: null,
              ultimoErro: expirado
                ? 'Janela de envio do resumo diário expirada. Use reenviar ou copiar manualmente.'
                : null,
              enviadoEm: null,
              entregueEm: null,
              copiadoManualmenteEm: null,
            }),
          );

          await repoExecucao.save(
            repoExecucao.create({
              regraId: regra.id,
              destinoId: regra.destinoId,
              dataReferencia: local.data,
              desfecho: expirado ? 'EXPIRADO' : 'AGENDADO',
              outboxId: outbox.id,
            }),
          );

          if (!expirado && elegiveis.length > 0) {
            const repoResumo = manager.getRepository(ResumoEnviadoPedido);
            for (const { pedido } of elegiveis) {
              await repoResumo.save(
                repoResumo.create({
                  outboxId: outbox.id,
                  regraId: regra.id,
                  destinoId: regra.destinoId,
                  dataReferencia: local.data,
                  pedidoId: pedido.id,
                  pedidoRevisao: pedido.notificacaoRevisao,
                }),
              );
            }
          }

          return expirado ? ('EXPIRADO' as const) : ('AGENDADO' as const);
        });

        if (desfecho === 'AGENDADO') resultado.agendados += 1;
        else if (desfecho === 'EXPIRADO') resultado.expirados += 1;
        else if (desfecho === 'OMITIDO') resultado.omitidos += 1;
      } catch (erro) {
        // Corrida entre dois workers: as chaves únicas impedem resumo duplicado.
        if (
          ehViolacaoDeUnicidade(erro, RESTRICAO_CHAVE_DEDUPLICACAO) ||
          ehViolacaoDeUnicidade(erro, RESTRICAO_EXECUCAO_RESUMO_UNICA)
        ) {
          continue;
        }
        throw erro;
      }
    }

    return resultado;
  }
}
