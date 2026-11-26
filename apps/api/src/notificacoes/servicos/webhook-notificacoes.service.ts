import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EstadoConectorNotificacao } from '../entities/estado-conector-notificacao.entity.js';
import { OutboxNotificacao } from '../entities/outbox-notificacao.entity.js';
import { ConfiguracaoNotificacoesService } from './configuracao-notificacoes.service.js';

export type EventoWebhookConector =
  | {
      evento: 'message.ack';
      idExterno: string;
      entregue: boolean;
    }
  | {
      evento: 'device.logged_out' | 'device.temporary_ban';
      motivo?: string;
    }
  | {
      evento: 'device.connected';
    };

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
      if (!evento.entregue || !evento.idExterno) return { aplicado: false };
      const resultado = await this.dataSource
        .createQueryBuilder()
        .update(OutboxNotificacao)
        .set({
          status: 'ENTREGUE',
          entregueEm: agora,
          ultimoErro: null,
        })
        .where('id_externo = :idExterno', { idExterno: evento.idExterno })
        .andWhere('status IN (:...status)', { status: ['ACEITO', 'INCERTO'] })
        .execute();
      return { aplicado: (resultado.affected ?? 0) > 0 };
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
}
