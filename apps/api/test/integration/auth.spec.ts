import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource, IsNull } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RefreshToken } from '../../src/auth/refresh-token.entity.js';
import type { ErrorBody } from '../../src/common/filters/all-exceptions.filter.js';
import { cookieDeRefresh, criarUsuario, novoIp, SENHA_PADRAO, setCookies } from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { createTestApp } from './helpers/test-app.js';

interface CorpoSessao {
  data: {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    usuario: Record<string, unknown>;
  };
}

describe('autenticação', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  const TELEFONE = '11987654321';

  beforeEach(async () => {
    await limparBanco(app);
    await criarUsuario(app, { telefone: TELEFONE, papel: 'ADMIN' });
  });

  afterAll(async () => {
    await app.close();
  });

  function http() {
    return request(app.getHttpServer());
  }

  async function login(ip = novoIp()) {
    return (
      http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        // Máscara digitada na tela é aceita: só os dígitos contam.
        .send({ telefone: '(11) 98765-4321', senha: SENHA_PADRAO })
    );
  }

  async function refresh(cookie: string | undefined) {
    const chamada = http().post('/api/v1/auth/refresh').set('X-Forwarded-For', novoIp());
    return cookie ? chamada.set('Cookie', cookie) : chamada;
  }

  describe('POST /auth/login', () => {
    it('emite access token no corpo e refresh token apenas em cookie protegido', async () => {
      const resposta = await login();

      expect(resposta.status).toBe(200);
      const corpo = resposta.body as CorpoSessao;
      expect(corpo.data).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(corpo.data.accessToken.split('.')).toHaveLength(3);
      expect(corpo.data.usuario).toMatchObject({
        nome: 'Lúcia Andrade',
        telefone: TELEFONE,
        papel: 'ADMIN',
        trocarSenha: false,
      });
      expect(JSON.stringify(corpo)).not.toMatch(/"senha(Hash)?"|argon2|refreshToken|tokenHash/i);

      const cookie = setCookies(resposta).find((c) => c.startsWith('mira_refresh='));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('responde igual para telefone sem conta e senha incorreta', async () => {
      const senhaErrada = await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: TELEFONE, senha: 'senha-incorreta' });
      const semConta = await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: '11900000000', senha: 'senha-incorreta' });

      const semRequestId = (corpo: unknown) => {
        const { requestId: _ignorado, ...resto } = (corpo as ErrorBody).error;
        return resto;
      };
      expect(senhaErrada.status).toBe(401);
      expect(semConta.status).toBe(401);
      expect(semRequestId(senhaErrada.body)).toEqual(semRequestId(semConta.body));
      expect(semRequestId(senhaErrada.body)).toEqual({
        code: 'CREDENCIAIS_INVALIDAS',
        message: 'Telefone ou senha incorretos.',
      });
      expect(cookieDeRefresh(senhaErrada)).toBeUndefined();
    });

    it('rejeita propriedades não declaradas no corpo', async () => {
      const resposta = await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: TELEFONE, senha: SENHA_PADRAO, admin: true });

      expect(resposta.status).toBe(400);
      expect((resposta.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    });

    it('limita tentativas por IP e responde 429 acima do limite', async () => {
      const ip = novoIp();
      const status: number[] = [];
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        const resposta = await http()
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ telefone: TELEFONE, senha: 'senha-incorreta' });
        status.push(resposta.status);
      }

      expect(status.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(status[5]).toBe(429);
    });
  });

  it('bloqueia o telefone depois de 10 falhas, mesmo trocando de IP', async () => {
    const alvo = '11955554444';
    await criarUsuario(app, { telefone: alvo });
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: alvo, senha: 'senha-incorreta' })
        .expect(401);
    }

    const comASenhaCerta = await http()
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: alvo, senha: SENHA_PADRAO });

    expect(comASenhaCerta.status).toBe(429);
    expect((comASenhaCerta.body as ErrorBody).error.code).toBe('MUITAS_TENTATIVAS');
  });

  describe('POST /auth/refresh', () => {
    it('troca o refresh token por um novo e emite novo access token', async () => {
      const primeiro = cookieDeRefresh(await login());
      const resposta = await refresh(primeiro);

      expect(resposta.status).toBe(200);
      expect((resposta.body as CorpoSessao).data.accessToken).toBeTruthy();
      const segundo = cookieDeRefresh(resposta);
      expect(segundo).toBeDefined();
      expect(segundo).not.toBe(primeiro);
    });

    it('detecta reuso de token já trocado e revoga toda a família', async () => {
      const original = cookieDeRefresh(await login());
      const renovado = cookieDeRefresh(await refresh(original));

      const reuso = await refresh(original);
      expect(reuso.status).toBe(401);
      expect((reuso.body as ErrorBody).error.code).toBe('SESSAO_INVALIDA');

      // O token legítimo mais recente também deixa de valer: não há como saber
      // qual das duas partes é a dona da sessão.
      const legitimo = await refresh(renovado);
      expect(legitimo.status).toBe(401);

      const tokens = app.get(DataSource).getRepository(RefreshToken);
      expect(await tokens.count()).toBe(2);
      expect(await tokens.countBy({ revokedAt: IsNull() })).toBe(0);
    });

    it('recusa renovação sem cookie e limpa o cookie em qualquer falha', async () => {
      const semCookie = await refresh(undefined);
      expect(semCookie.status).toBe(401);

      const adulterado = await refresh('mira_refresh=valor-inventado');
      expect(adulterado.status).toBe(401);
      expect(setCookies(adulterado).some((c) => c.startsWith('mira_refresh=;'))).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoga a sessão: o refresh token deixa de funcionar', async () => {
      const cookie = cookieDeRefresh(await login());

      const saida = await http()
        .post('/api/v1/auth/logout')
        .set('X-Forwarded-For', novoIp())
        .set('Cookie', cookie ?? '');
      expect(saida.status).toBe(204);

      expect((await refresh(cookie)).status).toBe(401);
    });
  });

  describe('rotas protegidas', () => {
    it('exigem access token válido', async () => {
      const semToken = await http().get('/api/v1/auditoria');
      const tokenInvalido = await http()
        .get('/api/v1/auditoria')
        .set('Authorization', 'Bearer abc.def.ghi');

      expect(semToken.status).toBe(401);
      expect(tokenInvalido.status).toBe(401);
      expect((semToken.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    });

    it('aceitam o access token emitido no login', async () => {
      const { accessToken } = ((await login()).body as CorpoSessao).data;

      const resposta = await http()
        .get('/api/v1/auditoria')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(resposta.status).toBe(200);
    });
  });

  it('não tem cadastro público: contas são criadas só por administradores', async () => {
    const registro = await http()
      .post('/api/v1/auth/registro')
      .set('X-Forwarded-For', novoIp())
      .send({ nome: 'Intruso', telefone: '11911112222', senha: 'senha-bem-longa-123' });
    const configuracao = await http().get('/api/v1/auth/configuracao');

    expect(registro.status).toBe(404);
    expect(configuracao.status).toBe(404);
  });
});
