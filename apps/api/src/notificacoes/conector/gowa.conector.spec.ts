import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GowaConector, resolverUrlInternaGowa } from './gowa.conector.js';

const PNG_MINIMO = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);

type RotaFake = (req: IncomingMessage, res: ServerResponse, corpo: string) => void | Promise<void>;

describe('GowaConector', () => {
  let servidor: Server;
  let baseUrl: string;
  let handlerAtual: RotaFake;
  let ultimaAuth: string | undefined;
  let ultimoDeviceId: string | undefined;

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      ultimaAuth = req.headers.authorization;
      ultimoDeviceId =
        typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'] : undefined;
      const partes: Buffer[] = [];
      req.on('data', (chunk: Buffer) => partes.push(chunk));
      req.on('end', () => {
        void handlerAtual(req, res, Buffer.concat(partes).toString('utf8'));
      });
    });
    await new Promise<void>((resolve) => {
      servidor.listen(0, '127.0.0.1', resolve);
    });
    const porta = (servidor.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${String(porta)}`;
  });

  beforeEach(() => {
    ultimaAuth = undefined;
    ultimoDeviceId = undefined;
    handlerAtual = (_req, res) => {
      res.writeHead(404).end();
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      servidor.close(() => {
        resolve();
      });
    });
  });

  function conector(
    extras: Partial<ConstructorParameters<typeof GowaConector>[0]> = {},
  ): GowaConector {
    return new GowaConector({
      baseUrl,
      token: 'mira:senha-gowa',
      deviceId: 'dev-1',
      timeoutEnvioMs: 300,
      timeoutConsultaMs: 300,
      ...extras,
    });
  }

  it('envia texto com Basic Auth + X-Device-Id e classifica ACEITO, DESCONECTADO, FALHA_PERMANENTE e INCERTO em timeout', async () => {
    handlerAtual = (req, res, corpo) => {
      if (req.url === '/send/message' && req.method === 'POST') {
        const json = JSON.parse(corpo) as { phone: string; message: string };
        expect(json.phone).toBe('1203630001@g.us');
        expect(json.message).toBe('*Nova encomenda #1043*');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'SUCCESS',
            message: 'Success',
            results: { message_id: '3EB0ABC123' },
          }),
        );
      }
    };

    const ok = await conector().enviarTexto('1203630001@g.us', '*Nova encomenda #1043*', 'k1');
    expect(ok).toEqual({ tipo: 'ACEITO', idExterno: '3EB0ABC123' });
    expect(ultimaAuth).toBe(`Basic ${Buffer.from('mira:senha-gowa').toString('base64')}`);
    expect(ultimoDeviceId).toBe('dev-1');

    // Desconectado (mensagem de sessão fora).
    handlerAtual = (_req, res) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'INTERNAL_SERVER_ERROR', message: 'you are not logged in' }));
    };
    const off = await conector().enviarTexto('1203630001@g.us', 'teste', 'k2');
    expect(off.tipo).toBe('DESCONECTADO');

    // 400 -> FALHA_PERMANENTE.
    handlerAtual = (_req, res) => {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'BAD_REQUEST', message: 'invalid jid' }));
    };
    const perm = await conector().enviarTexto('invalido', 'teste', 'k3');
    expect(perm.tipo).toBe('FALHA_PERMANENTE');

    // Timeout -> INCERTO (nunca reenvio automático).
    handlerAtual = (_req, res) => {
      setTimeout(() => {
        if (!res.writableEnded) res.writeHead(200).end('{}');
      }, 600);
    };
    const incerto = await conector({ timeoutEnvioMs: 80 }).enviarTexto(
      '1203630001@g.us',
      'teste',
      'k4',
    );
    expect(incerto.tipo).toBe('INCERTO');
  });

  it('consulta estado em /app/status e lista grupos ordenados de /user/my/groups', async () => {
    handlerAtual = (req, res) => {
      if (req.url === '/app/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'SUCCESS',
            results: {
              is_connected: true,
              is_logged_in: true,
              jid: '5511999990000@s.whatsapp.net',
            },
          }),
        );
        return;
      }
      if (req.url === '/user/my/groups') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'SUCCESS',
            results: {
              data: [
                { JID: '2@g.us', Name: 'Forno Teste' },
                { JID: '1@g.us', Name: 'Equipe Mira' },
              ],
            },
          }),
        );
      }
    };

    expect((await conector().obterEstado()).estado).toBe('CONECTADO');
    expect(await conector().listarGrupos()).toEqual([
      { id: '1@g.us', nome: 'Equipe Mira' },
      { id: '2@g.us', nome: 'Forno Teste' },
    ]);
  });

  it('pareia por QR Code (convertendo PNG interno em data URI) e por código de 8 dígitos', async () => {
    handlerAtual = (req, res) => {
      if (req.url === '/app/login') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'SUCCESS',
            results: {
              qr_duration: 30,
              qr_link: 'http://localhost:3000/statics/images/qrcode/scan.png',
            },
          }),
        );
        return;
      }
      if (req.url === '/statics/images/qrcode/scan.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG_MINIMO);
        return;
      }
      if (req.url === '/app/login-with-code?phone=5511987654321') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            code: 'SUCCESS',
            results: { pair_code: 'ABCD-1234' },
          }),
        );
      }
    };

    const qr = await conector().iniciarPareamento('QR');
    expect(qr.qrCode).toMatch(/^data:image\/png;base64,/);

    const codigo = await conector().iniciarPareamento('CODIGO', '(11) 98765-4321');
    expect(codigo.codigo).toBe('ABCD-1234');
  });

  it('bloqueia SSRF se qr_link apontar para host externo', () => {
    expect(resolverUrlInternaGowa('http://gowa:3000', 'http://localhost:3000/statics/qr.png')).toBe(
      'http://gowa:3000/statics/qr.png',
    );
    expect(
      resolverUrlInternaGowa('http://gowa:3000', 'https://atacante.example/qr.png'),
    ).toBeNull();
  });
});
