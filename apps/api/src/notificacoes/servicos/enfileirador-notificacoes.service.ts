import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { ItemPedido } from '../../pedidos/itens/item-pedido.entity.js';
import { Pedido } from '../../pedidos/pedido.entity.js';
import { avaliarJanelaResumo } from '../dominio/calendario.js';
import type { TipoEventoNotificacao } from '../dominio/enums.js';
import { formatarAvisoPedido } from '../dominio/formatacao.js';
import { hashProjecaoPedido, type ProjecaoPedido, projetarPedido } from '../dominio/projecao.js';
import {
  chaveDeduplicacaoPedido,
  classificarEventoComplemento,
  classificarEventoImediato,
  encomendaCorrespondeARegra,
  itensParaMensagem,
  mudancaIncrementaRevisao,
  preparosDestacadosDaRegra,
} from '../dominio/regras.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { RegraNotificacao } from '../entities/regra-notificacao.entity.js';
import { ResumoEnviadoPedido } from '../entities/resumo-enviado-pedido.entity.js';

export interface EntradaMudancaPedido {
  pedido: Pedido;
  antes: ProjecaoPedido | null;
  depois: ProjecaoPedido;
  agora?: Date;
}

interface CandidatoOutbox {
  destinoId: string;
  regra: RegraNotificacao;
  evento: Extract<
    TipoEventoNotificacao,
    'AVISO_IMEDIATO' | 'CORRECAO' | 'CANCELAMENTO' | 'COMPLEMENTO'
  >;
}

/**
 * Grava intenções de notificação na tabela `outbox_notificacoes` dentro da
 * mesma transação (e sob o mesmo `FOR UPDATE`) das mutações de pedido e itens.
 * Se a transação falhar ou sofrer rollback, nenhuma notificação é enfileirada.
 */
@Injectable()
export class EnfileiradorNotificacoesService {
  /** Carrega a projeção notificável atual de um pedido dentro da transação. */
  async projetarAtual(manager: EntityManager, pedido: Pedido): Promise<ProjecaoPedido> {
    const itens = await manager.getRepository(ItemPedido).find({
      where: { pedidoId: pedido.id },
      relations: { produto: true },
      order: { criadoEm: 'ASC', id: 'ASC' },
    });
    return projetarPedido(
      {
        id: pedido.id,
        numero: pedido.numero,
        status: pedido.status,
        dataEntrega: pedido.dataEntrega,
        horarioEntrega: pedido.horarioEntrega,
        tipoEntrega: pedido.tipoEntrega,
      },
      itens.map((item) => ({
        produtoId: item.produtoId,
        produtoNome: item.produto?.nome ?? 'Produto',
        preparo: item.preparo,
        unidadeVenda: item.unidadeVenda,
        quantidade: item.quantidade,
      })),
    );
  }

  async registrarMudancaDePedido(
    manager: EntityManager,
    entrada: EntradaMudancaPedido,
  ): Promise<void> {
    const { pedido, antes, depois } = entrada;
    const agora = entrada.agora ?? new Date();

    if (!mudancaIncrementaRevisao(antes, depois)) return;

    const novoHash = hashProjecaoPedido(depois);
    if (pedido.notificacaoRevisao > 0 && pedido.notificacaoHash === novoHash) return;

    const novaRevisao = pedido.notificacaoRevisao + 1;
    pedido.notificacaoRevisao = novaRevisao;
    pedido.notificacaoHash = novoHash;

    await manager.getRepository(Pedido).update(pedido.id, {
      notificacaoRevisao: novaRevisao,
      notificacaoHash: novoHash,
    });

    const regrasAtivas = await manager
      .getRepository(RegraNotificacao)
      .createQueryBuilder('regra')
      .innerJoinAndSelect('regra.destino', 'destino')
      .where('regra.ativa = true')
      .andWhere('destino.ativo = true')
      .orderBy('regra.tipo', 'ASC')
      .addOrderBy('regra.criadoEm', 'ASC')
      .getMany();

    if (regrasAtivas.length === 0) return;

    const porDestino = new Map<string, CandidatoOutbox>();

    // 1. Regras de aviso imediato têm precedência sobre complementos para o mesmo destino.
    for (const regra of regrasAtivas) {
      if (regra.tipo !== 'AVISO_IMEDIATO') continue;
      const evento = classificarEventoImediato(antes, depois, regra);
      if (evento && !porDestino.has(regra.destinoId)) {
        porDestino.set(regra.destinoId, { destinoId: regra.destinoId, regra, evento });
      }
    }

    // 2. Complementos / correções pós-resumo para regras RESUMO_DIARIO ativas.
    const regrasResumo = regrasAtivas.filter(
      (regra) => regra.tipo === 'RESUMO_DIARIO' && regra.enviarComplementos,
    );
    if (regrasResumo.length > 0) {
      const enviadosDoPedido = await manager.getRepository(ResumoEnviadoPedido).findBy({
        pedidoId: pedido.id,
      });
      const resumosDaDataDepois = await manager
        .getRepository(OutboxNotificacao)
        .createQueryBuilder('outbox')
        .select(['outbox.regraId', 'outbox.destinoId'])
        .where('outbox.tipoEvento = :tipo', { tipo: 'RESUMO_DIARIO' })
        .andWhere('outbox.dataReferencia = :data', { data: depois.dataEntrega })
        .andWhere('outbox.status IN (:...status)', {
          status: ['PENDENTE', 'ACEITO', 'ENTREGUE', 'INCERTO'],
        })
        .getMany();

      for (const regra of regrasResumo) {
        if (porDestino.has(regra.destinoId)) continue;

        const estavaNoResumo = enviadosDoPedido.some(
          (item) => item.regraId === regra.id && item.destinoId === regra.destinoId,
        );
        const jaTemOutboxResumo = resumosDaDataDepois.some(
          (item) => item.regraId === regra.id && item.destinoId === regra.destinoId,
        );
        // Se o resumo do próprio dia já passou do horário (inclusive omitido por vazio),
        // novas encomendas do mesmo dia também entram como complemento.
        const janela = avaliarJanelaResumo(agora, regra);
        const diaDeHojeJaPassouHorario =
          janela.local.data === depois.dataEntrega &&
          (janela.situacao === 'NA_JANELA' || janela.situacao === 'EXPIRADO');

        const evento = classificarEventoComplemento(antes, depois, regra, {
          estavaNoResumo,
          dataDepoisJaResumida: jaTemOutboxResumo || diaDeHojeJaPassouHorario,
        });
        if (evento) {
          porDestino.set(regra.destinoId, { destinoId: regra.destinoId, regra, evento });
        }
      }
    }

    for (const candidato of porDestino.values()) {
      await this.enfileirarParaDestino(manager, pedido, depois, candidato, agora);
    }
  }

  private async enfileirarParaDestino(
    manager: EntityManager,
    pedido: Pedido,
    depois: ProjecaoPedido,
    candidato: CandidatoOutbox,
    agora: Date,
  ): Promise<void> {
    const { destinoId, regra, evento } = candidato;

    // Substitui pendências anteriores ainda não despachadas do mesmo (pedido, destino).
    await manager
      .createQueryBuilder()
      .update(OutboxNotificacao)
      .set({
        status: 'SUBSTITUIDO',
        reservadoAte: null,
        reservadoPor: null,
      })
      .where('pedido_id = :pedidoId', { pedidoId: pedido.id })
      .andWhere('destino_id = :destinoId', { destinoId })
      .andWhere('status = :status', { status: 'PENDENTE' })
      .andWhere('pedido_revisao < :revisao', { revisao: pedido.notificacaoRevisao })
      .execute();

    const ehConfirmacaoInicial =
      pedido.notificacaoRevisao === 1 && (evento === 'AVISO_IMEDIATO' || evento === 'COMPLEMENTO');
    const disponivelEm = ehConfirmacaoInicial
      ? agora
      : new Date(agora.getTime() + regra.debounceSegundos * 1000);

    const removidoDoFiltro = evento === 'CORRECAO' && !encomendaCorrespondeARegra(depois, regra);
    const textoRenderizado = formatarAvisoPedido(evento, depois, {
      itens: itensParaMensagem(depois, regra),
      destacarPreparos: preparosDestacadosDaRegra(regra),
      removidoDoFiltro,
    });

    const chave = chaveDeduplicacaoPedido(destinoId, pedido.id, pedido.notificacaoRevisao);

    await manager
      .createQueryBuilder()
      .insert()
      .into(OutboxNotificacao)
      .values({
        chaveDeduplicacao: chave,
        tipoEvento: evento,
        status: 'PENDENTE',
        regraId: regra.id,
        destinoId,
        pedidoId: pedido.id,
        pedidoRevisao: pedido.notificacaoRevisao,
        dataReferencia: depois.dataEntrega,
        textoRenderizado,
        disponivelEm,
        reservadoAte: null,
        reservadoPor: null,
        tentativas: 0,
        maxTentativas: 5,
        idExterno: null,
        ultimoErro: null,
        enviadoEm: null,
        entregueEm: null,
        copiadoManualmenteEm: null,
      })
      .orIgnore()
      .execute();
  }
}
