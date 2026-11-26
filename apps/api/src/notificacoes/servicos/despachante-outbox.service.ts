import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { Pedido } from '../../pedidos/pedido.entity.js';
import { CONECTOR_WHATSAPP, type ConectorWhatsApp } from '../conector/conector-whatsapp.js';
import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { ConfiguracaoNotificacoesService } from './configuracao-notificacoes.service.js';

const LEASE_PADRAO_MS = 60_000;
const LIMITE_LOTE_PADRAO = 10;
const BACKOFF_BASE_SEGUNDOS = 30;
const BACKOFF_MAX_SEGUNDOS = 600;

export interface OpcoesDespacho {
  limite?: number;
  workerId?: string;
  agora?: Date;
  leaseMs?: number;
}

export interface ResultadoDespacho {
  processados: number;
  enviados: number;
  ignorados: number;
  falhas: number;
  incertos: number;
  pausado: boolean;
}

function truncar(texto: string, limite: number): string {
  return texto.length > limite ? texto.slice(0, limite) : texto;
}

function calcularBackoffSegundos(tentativa: number): number {
  const exponencial = BACKOFF_BASE_SEGUNDOS * 2 ** Math.max(0, tentativa - 1);
  return Math.min(exponencial, BACKOFF_MAX_SEGUNDOS);
}

/**
 * Despacha notificações pendentes da tabela `outbox_notificacoes` usando
 * reivindicação atômica com `FOR UPDATE SKIP LOCKED` e lease com expiração.
 * Nunca mantém transação de banco aberta durante a chamada ao conector externo.
 */
@Injectable()
export class DespachanteOutboxService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CONECTOR_WHATSAPP) private readonly conector: ConectorWhatsApp,
    private readonly configuracao: ConfiguracaoNotificacoesService,
  ) {}

  async processarPendentes(opcoes: OpcoesDespacho = {}): Promise<ResultadoDespacho> {
    const agora = opcoes.agora ?? new Date();
    const limite = opcoes.limite ?? LIMITE_LOTE_PADRAO;
    const workerId = opcoes.workerId ?? `worker-${String(process.pid)}`;
    const leaseMs = opcoes.leaseMs ?? LEASE_PADRAO_MS;

    const resultado: ResultadoDespacho = {
      processados: 0,
      enviados: 0,
      ignorados: 0,
      falhas: 0,
      incertos: 0,
      pausado: false,
    };

    const estado = await this.carregarEstado();
    if (estado.pausado || estado.modo === 'DESLIGADO' || estado.estado === 'DESCONECTADO') {
      resultado.pausado = true;
      return resultado;
    }

    const idsReivindicados = await this.reivindicarLote(limite, workerId, agora, leaseMs);
    for (const id of idsReivindicados) {
      const interromper = await this.processarItem(id, workerId, agora, resultado);
      if (interromper) {
        resultado.pausado = true;
        break;
      }
    }

    return resultado;
  }

  private async carregarEstado(): Promise<EstadoConectorNotificacao> {
    const existente = await this.dataSource
      .getRepository(EstadoConectorNotificacao)
      .findOneBy({ canal: 'WHATSAPP' });
    if (existente) return existente;
    const padroes = await this.dataSource.transaction((manager) =>
      this.configuracao.garantirPadroes(manager),
    );
    return padroes.estado;
  }

  private async reivindicarLote(
    limite: number,
    workerId: string,
    agora: Date,
    leaseMs: number,
  ): Promise<string[]> {
    const reservadoAte = new Date(agora.getTime() + leaseMs);
    return this.dataSource.transaction(async (manager) => {
      const linhas = await manager.query<{ id: string }[]>(
        `
        SELECT id
        FROM outbox_notificacoes
        WHERE status = 'PENDENTE'
          AND disponivel_em <= $1
          AND (reservado_ate IS NULL OR reservado_ate < $1)
        ORDER BY disponivel_em ASC, criado_em ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
        `,
        [agora, limite],
      );
      const ids = linhas.map((linha) => linha.id);
      if (ids.length === 0) return [];

      await manager.query(
        `
        UPDATE outbox_notificacoes
        SET reservado_ate = $1, reservado_por = $2, atualizado_em = now()
        WHERE id = ANY($3::uuid[])
        `,
        [reservadoAte, workerId, ids],
      );
      return ids;
    });
  }

  private async processarItem(
    id: string,
    workerId: string,
    agora: Date,
    resultado: ResultadoDespacho,
  ): Promise<boolean> {
    const estadoAtual = await this.carregarEstado();
    if (
      estadoAtual.pausado ||
      estadoAtual.modo === 'DESLIGADO' ||
      estadoAtual.estado === 'DESCONECTADO'
    ) {
      await this.liberarReserva(id, workerId);
      return true;
    }

    const item = await this.dataSource.getRepository(OutboxNotificacao).findOne({
      where: { id },
      relations: { destino: true, regra: true },
    });
    if (item?.status !== 'PENDENTE' || item.reservadoPor !== workerId) {
      return false;
    }

    resultado.processados += 1;

    // Revalidação antes do disparo: revisão antiga, regra desativada ou destino inativo.
    if (item.pedidoId && item.pedidoRevisao !== null) {
      const pedido = await this.dataSource.getRepository(Pedido).findOne({
        select: { id: true, notificacaoRevisao: true },
        where: { id: item.pedidoId },
      });
      if (pedido && pedido.notificacaoRevisao > item.pedidoRevisao) {
        await this.atualizarFinal(id, {
          status: 'SUBSTITUIDO',
          reservadoAte: null,
          reservadoPor: null,
        });
        resultado.ignorados += 1;
        return false;
      }
    }

    if (item.regra?.ativa === false && item.tipoEvento !== 'TESTE') {
      await this.atualizarFinal(id, {
        status: 'CANCELADO',
        ultimoErro: 'Regra desativada antes do envio.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.ignorados += 1;
      return false;
    }

    const destino = item.destino;
    if (!destino?.ativo || !destino.identificadorExterno) {
      await this.atualizarFinal(id, {
        status: 'FALHA',
        ultimoErro: 'Destino inativo ou sem identificador configurado.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.falhas += 1;
      return false;
    }

    if (!item.textoRenderizado) {
      await this.atualizarFinal(id, {
        status: 'FALHA',
        ultimoErro: 'Mensagem vazia ou já limpa por retenção.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.falhas += 1;
      return false;
    }

    // Chamada externa fora de qualquer transação de banco.
    const retorno = await this.enviarSeguro(
      destino.identificadorExterno,
      item.textoRenderizado,
      item.chaveDeduplicacao,
    );

    if (retorno.tipo === 'ACEITO') {
      await this.atualizarFinal(id, {
        status: 'ACEITO',
        idExterno: truncar(retorno.idExterno, 160),
        enviadoEm: agora,
        tentativas: item.tentativas + 1,
        ultimoErro: null,
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.enviados += 1;
      return false;
    }

    if (retorno.tipo === 'ENTREGUE') {
      await this.atualizarFinal(id, {
        status: 'ENTREGUE',
        idExterno: truncar(retorno.idExterno, 160),
        enviadoEm: agora,
        entregueEm: agora,
        tentativas: item.tentativas + 1,
        ultimoErro: null,
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.enviados += 1;
      return false;
    }

    if (retorno.tipo === 'INCERTO') {
      // Nunca reenviar automaticamente um envio incerto (risco de duplicar no grupo).
      await this.atualizarFinal(id, {
        status: 'INCERTO',
        tentativas: item.tentativas + 1,
        ultimoErro: truncar(retorno.mensagem, 500),
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.incertos += 1;
      return false;
    }

    if (retorno.tipo === 'DESCONECTADO') {
      // Não queima tentativas: mantém PENDENTE, libera lease e pausa canal.
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(OutboxNotificacao).update(
          { id, status: 'PENDENTE' },
          {
            ultimoErro: truncar(retorno.mensagem, 500),
            reservadoAte: null,
            reservadoPor: null,
          },
        );
        await this.marcarDesconectado(manager, retorno.mensagem, agora);
      });
      return true;
    }

    if (retorno.tipo === 'FALHA_PERMANENTE') {
      await this.atualizarFinal(id, {
        status: 'FALHA',
        tentativas: item.tentativas + 1,
        ultimoErro: truncar(retorno.mensagem, 500),
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.falhas += 1;
      return false;
    }

    // FALHA_TRANSITORIA: aplica backoff exponencial até maxTentativas.
    const novasTentativas = item.tentativas + 1;
    const esgotou = novasTentativas >= item.maxTentativas;
    const proximoDisparo = new Date(
      agora.getTime() + calcularBackoffSegundos(novasTentativas) * 1000,
    );
    await this.atualizarFinal(id, {
      status: esgotou ? 'FALHA' : 'PENDENTE',
      tentativas: novasTentativas,
      disponivelEm: esgotou ? item.disponivelEm : proximoDisparo,
      ultimoErro: truncar(retorno.mensagem, 500),
      reservadoAte: null,
      reservadoPor: null,
    });
    if (esgotou) resultado.falhas += 1;
    return false;
  }

  private async enviarSeguro(destinoExterno: string, texto: string, chaveDeduplicacao: string) {
    try {
      return await this.conector.enviarTexto(destinoExterno, texto, chaveDeduplicacao);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro inesperado ao enviar mensagem.';
      return { tipo: 'FALHA_TRANSITORIA' as const, mensagem };
    }
  }

  private async liberarReserva(id: string, workerId: string): Promise<void> {
    await this.dataSource
      .getRepository(OutboxNotificacao)
      .update(
        { id, status: 'PENDENTE', reservadoPor: workerId },
        { reservadoAte: null, reservadoPor: null },
      );
  }

  private async atualizarFinal(id: string, dados: Partial<OutboxNotificacao>): Promise<void> {
    await this.dataSource
      .getRepository(OutboxNotificacao)
      .update({ id, status: 'PENDENTE' }, dados);
  }

  private async marcarDesconectado(
    manager: EntityManager,
    motivo: string,
    agora: Date,
  ): Promise<void> {
    await manager.getRepository(EstadoConectorNotificacao).update(
      { canal: 'WHATSAPP' },
      {
        estado: 'DESCONECTADO',
        pausado: true,
        motivoPausa: truncar(motivo, 240),
        ultimoErro: truncar(motivo, 500),
        ultimaVerificacaoEm: agora,
      },
    );
  }
}
