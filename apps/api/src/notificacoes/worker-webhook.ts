import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  type EventoWebhookConector,
  verificarAssinaturaHmac,
  type WebhookNotificacoesService,
} from './servicos/webhook-notificacoes.service.js';

const LIMITE_CORPO_BYTES = 64 * 1024;

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let tamanho = 0;
    req.on('data', (chunk: Buffer) => {
      tamanho += chunk.length;
      if (tamanho > LIMITE_CORPO_BYTES) {
        reject(new Error('CORPO_GRANDE_DEMAIS'));
        req.destroy();
        return;
      }
      partes.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(partes));
    });
    req.on('error', reject);
  });
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

const TIPOS_RECIBO_ENTREGUE = new Set(['delivered', 'read', 'read-self', 'played']);

/** Traduz payload de webhook (GoWA v9.x/WAHA ou formato interno) em evento tipado. */
export function extrairEventoWebhook(payload: unknown): EventoWebhookConector | null {
  const raiz = comoObjeto(payload);
  if (!raiz) return null;

  const tipo = typeof raiz['event'] === 'string' ? raiz['event'] : raiz['evento'];
  const dados = comoObjeto(raiz['payload']) ?? raiz;

  if (tipo === 'message.ack') {
    const idsBrutos = Array.isArray(dados['ids'])
      ? dados['ids'].filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const unico =
      typeof dados['idExterno'] === 'string'
        ? dados['idExterno']
        : typeof dados['message_id'] === 'string'
          ? dados['message_id']
          : typeof dados['id'] === 'string'
            ? dados['id']
            : '';
    const idsExternos = idsBrutos.length > 0 ? idsBrutos : unico ? [unico] : [];
    if (idsExternos.length === 0) return null;

    const ack = dados['ack'];
    const receiptType =
      typeof dados['receipt_type'] === 'string' ? dados['receipt_type'].toLowerCase() : '';
    const entregue =
      dados['entregue'] === true ||
      TIPOS_RECIBO_ENTREGUE.has(receiptType) ||
      (typeof ack === 'number' && ack >= 2) ||
      ack === 'DELIVERED' ||
      ack === 'READ';
    return { evento: 'message.ack', idsExternos, entregue };
  }

  if (
    tipo === 'device.logged_out' ||
    tipo === 'device.temporary_ban' ||
    tipo === 'device.reachout_timelock'
  ) {
    const motivo =
      typeof dados['motivo'] === 'string'
        ? dados['motivo']
        : typeof dados['reason'] === 'string'
          ? dados['reason']
          : undefined;
    return { evento: tipo, motivo };
  }

  if (tipo === 'device.connected') {
    return { evento: 'device.connected' };
  }

  return null;
}

function responderJson(res: ServerResponse, status: number, corpo: object): void {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(texto);
}

/**
 * Listener HTTP privado do worker para webhooks do conector WhatsApp na rede
 * interna Docker (nunca montado atrás do proxy público `/api/` do nginx).
 */
export function criarServidorWebhookPrivado(
  servico: WebhookNotificacoesService,
  segredo: string,
): Server {
  return createServer((req, res) => {
    void (async () => {
      if (req.method !== 'POST' || req.url !== '/webhooks/whatsapp') {
        responderJson(res, 404, { ok: false });
        return;
      }

      let corpoBruto: Buffer;
      try {
        corpoBruto = await lerCorpo(req);
      } catch {
        responderJson(res, 413, { ok: false, erro: 'Corpo excede o limite.' });
        return;
      }

      const assinatura =
        (typeof req.headers['x-hub-signature-256'] === 'string'
          ? req.headers['x-hub-signature-256']
          : undefined) ??
        (typeof req.headers['x-webhook-hmac'] === 'string'
          ? req.headers['x-webhook-hmac']
          : undefined);

      if (!verificarAssinaturaHmac(corpoBruto, assinatura, segredo)) {
        responderJson(res, 401, { ok: false, erro: 'Assinatura inválida.' });
        return;
      }

      let json: unknown;
      try {
        json = JSON.parse(corpoBruto.toString('utf8'));
      } catch {
        responderJson(res, 400, { ok: false, erro: 'JSON inválido.' });
        return;
      }

      const evento = extrairEventoWebhook(json);
      if (!evento) {
        responderJson(res, 202, { ok: true, ignorado: true });
        return;
      }

      const resultado = await servico.processarEvento(evento);
      responderJson(res, 200, { ok: true, ...resultado });
    })();
  });
}
