import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verificarAssinaturaHmac } from './servicos/webhook-notificacoes.service.js';
import { extrairEventoWebhook } from './worker-webhook.js';

describe('webhook privado de notificações', () => {
  const segredo = 'segredo-webhook-com-32-caracteres-minimo';

  it('valida assinatura HMAC-SHA-256 com ou sem prefixo sha256= e rejeita adulteração', () => {
    const corpo = Buffer.from(JSON.stringify({ event: 'message.ack', message_id: 'm1', ack: 2 }));
    const hex = createHmac('sha256', segredo).update(corpo).digest('hex');

    expect(verificarAssinaturaHmac(corpo, `sha256=${hex}`, segredo)).toBe(true);
    expect(verificarAssinaturaHmac(corpo, hex, segredo)).toBe(true);
    expect(verificarAssinaturaHmac(corpo, `sha256=${'0'.repeat(64)}`, segredo)).toBe(false);
    expect(verificarAssinaturaHmac(corpo, 'invalida', segredo)).toBe(false);
    expect(verificarAssinaturaHmac(corpo, undefined, segredo)).toBe(false);
    expect(verificarAssinaturaHmac(Buffer.from('adulterado'), `sha256=${hex}`, segredo)).toBe(
      false,
    );
  });

  it('extrai eventos suportados (message.ack, logged_out, temporary_ban, connected)', () => {
    expect(
      extrairEventoWebhook({ event: 'message.ack', payload: { message_id: 'sim-1', ack: 2 } }),
    ).toEqual({ evento: 'message.ack', idExterno: 'sim-1', entregue: true });

    expect(
      extrairEventoWebhook({ event: 'device.logged_out', payload: { reason: 'Sessão encerrada' } }),
    ).toEqual({ evento: 'device.logged_out', motivo: 'Sessão encerrada' });

    expect(extrairEventoWebhook({ event: 'device.temporary_ban' })).toEqual({
      evento: 'device.temporary_ban',
      motivo: undefined,
    });

    expect(extrairEventoWebhook({ event: 'evento.desconhecido' })).toBeNull();
  });
});
