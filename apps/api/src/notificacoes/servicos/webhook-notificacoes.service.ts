import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { ReciboNotificacao } from '../entities/recibo-notificacao.entity.js';
import { ConfiguracaoNotificacoesService } from './configuracao-notificacoes.service.js';

/** Namespace de advisory lock para serializar gravação de id_externo vs webhook message.ack. */
export const TRAVA_RECIBO_EXTERNO = 78_123_457;

export type EventoWebhookConector =
  | {
      evento: 'message.ack';
      idsExternos: readonly string[];
      entregue: boolean;
    }
  | {
      evento: 'device.logged_out' | 'device.temporary_ban' | 'device.reachout_timelock';
      motivo?: string;
    }
  | {
      evento: 'device.connected';
    };

/**
 * Consome um recibo de entrega antecipado (caso o webhook `message.ack` tenha
 * chegado antes de a resposta síncrona do conector gravar `id_externo`).
 * Deve ser chamado dentro de uma transação após adquirir `travaReciboExterno`.
 */
export async function consumirReciboAntecipado(
  manager: EntityManager,
  idExterno: string,
): Promise<Date | null> {
  await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
    TRAVA_RECIBO_EXTERNO,
    idExterno,
  ]);
  const resultado = await manager
    .createQueryBuilder()
    .delete()
    .from(ReciboNotificacao)
    .where('id_externo = :idExterno', { idExterno })
    .returning('recebido_em')
    .execute();
  const linhas = resultado.raw as { recebido_em?: Date | string }[];
  const recebido = linhas[0]?.recebido_em;
  if (!recebido) return null;
  return recebido instanceof Date ? recebido : new Date(recebido);
}

/**
 * Verifica assinatura HMAC-SHA-256 em tempo constante (`timingSafeEqual`).
 * Aceita assinatura hexadecimal pura ou prefixada com `sha256=`.
 */
export function verificarAssinaturaHmac(
  corpoBruto: Buffer,
  assinaturaRecebida: string | undefined,
  segredo: string,
): boolean {
  if (!assinaturaRecebida || !segredo) return false;
  const normalizada = assinaturaRecebida.startsWith('sha256=')
    ? assinaturaRecebida.slice('sha256='.length)
    : assinaturaRecebida;
  if (!/^[0-9a-f]{64}$/i.test(normalizada)) return false;

  const esperada = createHmac('sha256', segredo).update(corpoBruto).digest();
  const recebida = Buffer.from(normalizada, 'hex');
  if (esperada.length !== recebida.length) return false;
  return timingSafeEqual(esperada, recebida);
}

/**
 * Processa eventos recebidos no listener privado de webhook do worker (nunca
 * exposto atrás do nginx público).
 */
@Injectable()
export class WebhookNotificacoesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configuracao: ConfiguracaoNotificacoesService,
  ) {}

  async processarEvento(
    evento: EventoWebhookConector,
    agora = new Date(),
  ): Promise<{ aplicado: boolean }> {
    if (evento.evento === 'message.ack') {
      if (!evento.entregue || evento.idsExternos.length === 0) return { aplicado: false };
      return this.aplicarRecibosEntrega(evento.idsExternos, agora);
    }

    await this.dataSource.transaction(async (manager) => {
      await this.configuracao.garantirPadroes(manager);
      if (evento.evento === 'device.connected') {
        await manager.getRepository(EstadoConectorNotificacao).update(
          { canal: 'WHATSAPP' },
          {
            estado: 'CONECTADO',
            ultimoErro: null,
            ultimaVerificacaoEm: agora,
          },
        );
        return;
      }

      const motivo =
        evento.motivo ??
        (evento.evento === 'device.temporary_ban'
          ? 'Sessão do WhatsApp sofreu bloqueio temporário. Envios pausados.'
          : evento.evento === 'device.reachout_timelock'
            ? 'WhatsApp restringiu novos envios temporariamente. Envios pausados.'
            : 'Sessão do WhatsApp desconectada. Faça novo pareamento.');
      await manager.getRepository(EstadoConectorNotificacao).update(
        { canal: 'WHATSAPP' },
        {
          estado: 'DESCONECTADO',
          pausado: true,
          motivoPausa: motivo.slice(0, 240),
          ultimoErro: motivo.slice(0, 500),
          ultimaVerificacaoEm: agora,
        },
      );
    });

    return { aplicado: true };
  }

  private async aplicarRecibosEntrega(
    idsBrutos: readonly string[],
    agora: Date,
  ): Promise<{ aplicado: boolean }> {
    const ids = [...new Set(idsBrutos.map((id) => id.trim().slice(0, 160)).filter(Boolean))].sort();
    if (ids.length === 0) return { aplicado: false };

    return this.dataSource.transaction(async (manager) => {
      let aplicados = 0;
      let armazenados = 0;

      for (const idExterno of ids) {
        await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
          TRAVA_RECIBO_EXTERNO,
          idExterno,
        ]);

        const resultado = await manager
          .createQueryBuilder()
          .update(OutboxNotificacao)
          .set({
            status: 'ENTREGUE',
            entregueEm: () => 'COALESCE(entregue_em, :agora)',
            ultimoErro: null,
          })
          .setParameter('agora', agora)
          .where('id_externo = :idExterno', { idExterno })
          .andWhere('status IN (:...status)', { status: ['ACEITO', 'INCERTO'] })
          .execute();

        if ((resultado.affected ?? 0) > 0) {
          aplicados += resultado.affected ?? 0;
          continue;
        }

        const jaExiste = await manager.getRepository(OutboxNotificacao).existsBy({ idExterno });
        if (jaExiste) continue;

        await manager
          .createQueryBuilder()
          .insert()
          .into(ReciboNotificacao)
          .values({ idExterno, recebidoEm: agora })
          .orIgnore()
          .execute();
        armazenados += 1;
      }

      return { aplicado: aplicados > 0 || armazenados > 0 };
    });
  }
}
