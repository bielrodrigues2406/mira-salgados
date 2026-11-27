import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, IsNull } from 'typeorm';

import { CONECTOR_WHATSAPP, type ConectorWhatsApp } from '../conector/conector-whatsapp.js';
import { avaliarJanelaResumo } from '../dominio/calendario.js';
import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { ExecucaoResumoDiario } from '../entities/execucao-resumo-diario.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { ResumoEnviadoPedido } from '../entities/resumo-enviado-pedido.entity.js';
import { ConfiguracaoNotificacoesService } from './configuracao-notificacoes.service.js';
import { consumirReciboAntecipado } from './webhook-notificacoes.service.js';

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
 * reivindicação atômica com `FOR UPDATE SKIP LOCKED`, marcação atômica de envio
 * em andamento (`envio_iniciado_em`) e consumo de recibos antecipados.
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

    // Envios que já haviam iniciado chamada externa e tiveram o lease expirado
    // nunca podem ser reenviados automaticamente: passam para INCERTO.
    resultado.incertos += await this.expirarEnviosEmAndamento(agora);

    const estado = await this.carregarEstado();
    if (estado.pausado || estado.modo === 'DESLIGADO' || estado.estado === 'DESCONECTADO') {
      resultado.pausado = true;
      return resultado;
    }

    const idsReivindicados = await this.reivindicarLote(limite, workerId, agora, leaseMs);
    for (const id of idsReivindicados) {
      const interromper = await this.processarItem(id, workerId, agora, leaseMs, resultado);
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

  private async expirarEnviosEmAndamento(agora: Date): Promise<number> {
    const resultado = await this.dataSource
      .createQueryBuilder()
      .update(OutboxNotificacao)
      .set({
        status: 'INCERTO',
        ultimoErro: 'Reserva expirou com envio em andamento. Confirme no grupo antes de reenviar.',
        reservadoAte: null,
        reservadoPor: null,
      })
      .where('status = :status', { status: 'PENDENTE' })
      .andWhere('envio_iniciado_em IS NOT NULL')
      .andWhere('reservado_ate IS NOT NULL')
      .andWhere('reservado_ate < :agora', { agora })
      .execute();
    return resultado.affected ?? 0;
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
          AND envio_iniciado_em IS NULL
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
    leaseMs: number,
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
    if (item?.status !== 'PENDENTE' || item.reservadoPor !== workerId || item.envioIniciadoEm) {
      return false;
    }

    resultado.processados += 1;

    // Revalidação 1: só considera substituído se já houver outra revisão mais
    // nova enfileirada para o mesmo (pedido, destino). Assim, edições fora do
    // escopo da regra (ex.: só frito na regra de assados) não derrubam o aviso.
    if (item.pedidoId && item.pedidoRevisao !== null) {
      const existeMaisNova = await this.dataSource
        .getRepository(OutboxNotificacao)
        .createQueryBuilder('outbox')
        .where('outbox.pedidoId = :pedidoId', { pedidoId: item.pedidoId })
        .andWhere('outbox.destinoId = :destinoId', { destinoId: item.destinoId })
        .andWhere('outbox.pedidoRevisao > :revisao', { revisao: item.pedidoRevisao })
        .andWhere('outbox.status <> :cancelado', { cancelado: 'CANCELADO' })
        .getExists();
      if (existeMaisNova) {
        await this.atualizarPreEnvio(id, workerId, {
          status: 'SUBSTITUIDO',
          reservadoAte: null,
          reservadoPor: null,
        });
        resultado.ignorados += 1;
        return false;
      }
    }

    // Revalidação 2: regra desativada antes do envio.
    if (item.regra?.ativa === false && item.tipoEvento !== 'TESTE') {
      await this.atualizarPreEnvio(id, workerId, {
        status: 'CANCELADO',
        ultimoErro: 'Regra desativada antes do envio.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.ignorados += 1;
      return false;
    }

    // Revalidação 3: janela de tolerância do resumo diário (quando não houve
    // liberação explícita via reenvio manual, que limpa `expiraEm`).
    if (item.tipoEvento === 'RESUMO_DIARIO' && item.expiraEm !== null) {
      const passouLimite = agora.getTime() > item.expiraEm.getTime();
      const foraDaJanelaDaRegra =
        item.regra && item.dataReferencia
          ? (() => {
              const avaliacao = avaliarJanelaResumo(agora, item.regra);
              return (
                avaliacao.local.data !== item.dataReferencia ||
                avaliacao.situacao === 'EXPIRADO' ||
                avaliacao.situacao === 'FORA_DO_DIA'
              );
            })()
          : false;

      if (passouLimite || foraDaJanelaDaRegra) {
        await this.expirarResumoAntesDoEnvio(id, workerId);
        resultado.ignorados += 1;
        return false;
      }
    }

    // Revalidação 4: destino ativo e vinculado ao mesmo identificador externo
    // registrado no momento do enfileiramento (nunca redireciona para grupo novo).
    const destino = item.destino;
    if (!destino?.ativo || !destino.identificadorExterno) {
      await this.atualizarPreEnvio(id, workerId, {
        status: 'FALHA',
        ultimoErro: 'Destino inativo ou sem identificador configurado.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.falhas += 1;
      return false;
    }

    if (
      !item.destinoIdentificadorExterno ||
      item.destinoIdentificadorExterno !== destino.identificadorExterno
    ) {
      await this.atualizarPreEnvio(id, workerId, {
        status: 'CANCELADO',
        ultimoErro:
          'Grupo do destino alterado após o enfileiramento. Envio cancelado para evitar redirecionamento.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.ignorados += 1;
      return false;
    }

    if (!item.textoRenderizado) {
      await this.atualizarPreEnvio(id, workerId, {
        status: 'FALHA',
        ultimoErro: 'Mensagem vazia ou já limpa por retenção.',
        reservadoAte: null,
        reservadoPor: null,
      });
      resultado.falhas += 1;
      return false;
    }

    // Marca atomicamente o início da chamada externa ANTES de sair para a rede.
    // Se outra operação cancelou/substituiu o registro nesse instante, aborta.
    const envioIniciadoEm = agora;
    const reservadoAte = new Date(agora.getTime() + leaseMs);
    const novasTentativas = await this.marcarEnvioIniciado(
      id,
      workerId,
      envioIniciadoEm,
      reservadoAte,
    );
    if (novasTentativas === null) {
      return false;
    }

    // Chamada externa fora de qualquer transação de banco.
    const retorno = await this.enviarSeguro(
      item.destinoIdentificadorExterno,
      item.textoRenderizado,
      item.chaveDeduplicacao,
    );

    if (retorno.tipo === 'ACEITO' || retorno.tipo === 'ENTREGUE') {
      const idExterno = truncar(retorno.idExterno, 160);
      await this.dataSource.transaction(async (manager) => {
        const reciboAntecipado = await consumirReciboAntecipado(manager, idExterno);
        const entregueEm = retorno.tipo === 'ENTREGUE' ? agora : reciboAntecipado;
        const statusFinal = entregueEm ? 'ENTREGUE' : 'ACEITO';

        await manager.query(
          `
          UPDATE outbox_notificacoes
          SET status = $1,
              id_externo = $2,
              enviado_em = $3,
              entregue_em = $4,
              ultimo_erro = NULL,
              reservado_ate = NULL,
              reservado_por = NULL,
              atualizado_em = now()
          WHERE id = $5
            AND envio_iniciado_em = $6
            AND status IN ('PENDENTE', 'INCERTO')
          `,
          [statusFinal, idExterno, agora, entregueEm, id, envioIniciadoEm],
        );
      });
      resultado.enviados += 1;
      return false;
    }

    if (retorno.tipo === 'INCERTO') {
      // Nunca reenviar automaticamente um envio incerto (risco de duplicar no grupo).
      await this.atualizarPosEnvio(id, envioIniciadoEm, {
        status: 'INCERTO',
        ultimoErro: truncar(retorno.mensagem, 500),
      });
      resultado.incertos += 1;
      return false;
    }

    if (retorno.tipo === 'DESCONECTADO') {
      // Não queima tentativas: mantém PENDENTE, limpa envio_iniciado_em e pausa canal.
      await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `
          UPDATE outbox_notificacoes
          SET status = 'PENDENTE',
              envio_iniciado_em = NULL,
              tentativas = GREATEST(tentativas - 1, 0),
              ultimo_erro = $1,
              reservado_ate = NULL,
              reservado_por = NULL,
              atualizado_em = now()
          WHERE id = $2
            AND envio_iniciado_em = $3
            AND status IN ('PENDENTE', 'INCERTO')
          `,
          [truncar(retorno.mensagem, 500), id, envioIniciadoEm],
        );
        await this.marcarDesconectado(manager, retorno.mensagem, agora);
      });
      return true;
    }

    if (retorno.tipo === 'FALHA_PERMANENTE') {
      await this.atualizarPosEnvio(id, envioIniciadoEm, {
        status: 'FALHA',
        ultimoErro: truncar(retorno.mensagem, 500),
      });
      resultado.falhas += 1;
      return false;
    }

    // FALHA_TRANSITORIA: só reagenda se o lease ainda pertencer a este worker
    // (se outro ciclo já promoveu o item a INCERTO por expiração de lease, mantém INCERTO).
    const esgotou = novasTentativas >= item.maxTentativas;
    const proximoDisparo = new Date(
      agora.getTime() + calcularBackoffSegundos(novasTentativas) * 1000,
    );
    const atualizado = await this.dataSource
      .createQueryBuilder()
      .update(OutboxNotificacao)
      .set({
        status: esgotou ? 'FALHA' : 'PENDENTE',
        envioIniciadoEm: esgotou ? envioIniciadoEm : null,
        disponivelEm: esgotou ? item.disponivelEm : proximoDisparo,
        ultimoErro: truncar(retorno.mensagem, 500),
        reservadoAte: null,
        reservadoPor: null,
      })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: 'PENDENTE' })
      .andWhere('reservado_por = :workerId', { workerId })
      .andWhere('envio_iniciado_em = :envioIniciadoEm', { envioIniciadoEm })
      .execute();
    if (esgotou && (atualizado.affected ?? 0) > 0) resultado.falhas += 1;
    return false;
  }

  private async marcarEnvioIniciado(
    id: string,
    workerId: string,
    envioIniciadoEm: Date,
    reservadoAte: Date,
  ): Promise<number | null> {
    const resultado = await this.dataSource
      .createQueryBuilder()
      .update(OutboxNotificacao)
      .set({
        envioIniciadoEm,
        reservadoAte,
        tentativas: () => 'tentativas + 1',
      })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: 'PENDENTE' })
      .andWhere('reservado_por = :workerId', { workerId })
      .andWhere('envio_iniciado_em IS NULL')
      .returning('tentativas')
      .execute();
    const linhas = resultado.raw as { tentativas?: number }[];
    return linhas[0]?.tentativas ?? null;
  }

  private async expirarResumoAntesDoEnvio(id: string, workerId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const resultado = await manager.getRepository(OutboxNotificacao).update(
        { id, status: 'PENDENTE', reservadoPor: workerId, envioIniciadoEm: IsNull() },
        {
          status: 'EXPIRADO',
          ultimoErro:
            'Janela de envio do resumo diário expirada antes do despacho. Use reenviar ou copiar manualmente.',
          reservadoAte: null,
          reservadoPor: null,
        },
      );
      if ((resultado.affected ?? 0) === 0) return;

      await manager.getRepository(ResumoEnviadoPedido).delete({ outboxId: id });
      await manager
        .getRepository(ExecucaoResumoDiario)
        .update({ outboxId: id }, { desfecho: 'EXPIRADO' });
    });
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
        { id, status: 'PENDENTE', reservadoPor: workerId, envioIniciadoEm: IsNull() },
        { reservadoAte: null, reservadoPor: null },
      );
  }

  private async atualizarPreEnvio(
    id: string,
    workerId: string,
    dados: Partial<OutboxNotificacao>,
  ): Promise<void> {
    await this.dataSource
      .getRepository(OutboxNotificacao)
      .update({ id, status: 'PENDENTE', reservadoPor: workerId, envioIniciadoEm: IsNull() }, dados);
  }

  private async atualizarPosEnvio(
    id: string,
    envioIniciadoEm: Date,
    dados: { status: 'INCERTO' | 'FALHA'; ultimoErro: string },
  ): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE outbox_notificacoes
      SET status = $1,
          ultimo_erro = $2,
          reservado_ate = NULL,
          reservado_por = NULL,
          atualizado_em = now()
      WHERE id = $3
        AND envio_iniciado_em = $4
        AND status IN ('PENDENTE', 'INCERTO')
      `,
      [dados.status, dados.ultimoErro, id, envioIniciadoEm],
    );
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
