import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AUTH_MODE_KEY,
  PERMITE_SENHA_PROVISORIA_KEY,
  SOMENTE_ADMIN_KEY,
} from '../../src/common/auth/usuario-autenticado.js';
import { criarUsuario, novoIp, SENHA_PADRAO } from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { dadosDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Rota {
  metodo: 'get' | 'post' | 'patch' | 'delete';
  caminho: string;
  publica: boolean;
  somenteAdmin: boolean;
  permiteSenhaProvisoria: boolean;
}

const METODOS: Partial<Record<RequestMethod, Rota['metodo']>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

/**
 * Rotas que respondem sem token. Qualquer rota nova marcada como pública
 * precisa entrar aqui de propósito, ou este teste falha.
 */
const PUBLICAS = ['GET /health', 'POST /auth/login', 'POST /auth/refresh', 'POST /auth/logout'];

/** Só administradores: contas e histórico de alterações. */
const SOMENTE_ADMIN = [
  'GET /usuarios',
  'POST /usuarios',
  'PATCH /usuarios/:id',
  'POST /usuarios/:id/senha',
  'GET /auditoria',
];

const ID_QUALQUER = '00000000-0000-4000-8000-000000000000';

function juntar(...partes: string[]): string {
  return `/${partes
    .map((parte) => parte.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/')}`;
}

function metadado(chave: string, ...alvos: object[]): unknown {
  for (const alvo of alvos) {
    const valor: unknown = Reflect.getMetadata(chave, alvo);
    if (valor !== undefined) return valor;
  }
  return undefined;
}

/** Todas as rotas registradas, lidas dos metadados dos controllers da aplicação. */
function rotasDa(app: NestExpressApplication): Rota[] {
  const rotas: Rota[] = [];
  for (const modulo of app.get(ModulesContainer).values()) {
    for (const controller of modulo.controllers.values()) {
      const classe = controller.metatype as (new (...args: never[]) => object) | null;
      if (!classe) continue;
      const base = metadado(PATH_METADATA, classe);
      const prototipo = classe.prototype as Record<string, unknown>;
      for (const nome of Object.getOwnPropertyNames(prototipo)) {
        const handler = prototipo[nome];
        if (nome === 'constructor' || typeof handler !== 'function') continue;
        const caminho = metadado(PATH_METADATA, handler);
        const metodo = METODOS[metadado(METHOD_METADATA, handler) as RequestMethod];
        if (typeof caminho !== 'string' || typeof base !== 'string' || !metodo) continue;
        rotas.push({
          metodo,
          caminho: juntar(base, caminho),
          publica: metadado(AUTH_MODE_KEY, handler, classe) === 'public',
          somenteAdmin: metadado(SOMENTE_ADMIN_KEY, handler, classe) === true,
          permiteSenhaProvisoria: metadado(PERMITE_SENHA_PROVISORIA_KEY, handler, classe) === true,
        });
      }
    }
  }
  return rotas;
}

const rotulo = (rota: Rota): string => `${rota.metodo.toUpperCase()} ${rota.caminho}`;
const concreto = (rota: Rota): string => `/api/v1${rota.caminho.replace(/:[^/]+/g, ID_QUALQUER)}`;

describe('todas as rotas da API', () => {
  let app: NestExpressApplication;
  let rotas: Rota[];

  beforeAll(async () => {
    app = await createTestApp();
    await limparBanco(app);
    rotas = rotasDa(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function chamar(rota: Rota, token?: string): request.Test {
    const servidor = request(app.getHttpServer());
    const chamada = servidor[rota.metodo](concreto(rota)).set('X-Forwarded-For', novoIp());
    return token ? chamada.set('Authorization', `Bearer ${token}`) : chamada;
  }

  async function tokenDe(opcoes: Parameters<typeof criarUsuario>[1]): Promise<string> {
    const usuario = await criarUsuario(app, opcoes);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: usuario.telefone, senha: SENHA_PADRAO })
      .expect(200);
    return dadosDe<{ accessToken: string }>(login).accessToken;
  }

  it('encontra as rotas da aplicação', () => {
    expect(rotas.length).toBeGreaterThan(30);
  });

  it('só as rotas da lista respondem sem token', () => {
    expect(
      rotas
        .filter((rota) => rota.publica)
        .map(rotulo)
        .sort(),
    ).toEqual([...PUBLICAS].sort());
  });

  it('só contas e histórico são exclusivos de administradores', () => {
    expect(
      rotas
        .filter((rota) => rota.somenteAdmin)
        .map(rotulo)
        .sort(),
    ).toEqual([...SOMENTE_ADMIN].sort());
  });

  it('toda rota não pública responde 401 sem token, com token inválido ou adulterado', async () => {
    const tokenValido = await tokenDe({ papel: 'ADMIN' });
    const [cabecalho = '', corpo = ''] = tokenValido.split('.');
    const semAssinatura = `${cabecalho}.${corpo}.`;
    const falhas: string[] = [];
    for (const rota of rotas.filter((item) => !item.publica)) {
      for (const token of [undefined, 'abc.def.ghi', semAssinatura]) {
        const resposta = await chamar(rota, token);
        if (resposta.status !== 401) falhas.push(`${rotulo(rota)} → ${String(resposta.status)}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('membro recebe 403 nas rotas de administrador', async () => {
    const token = await tokenDe({ papel: 'MEMBRO' });
    const falhas: string[] = [];
    for (const rota of rotas.filter((item) => item.somenteAdmin)) {
      const resposta = await chamar(rota, token);
      const codigo = (resposta.body as { error?: { code?: string } }).error?.code;
      if (resposta.status !== 403 || codigo !== 'SOMENTE_ADMIN') {
        falhas.push(`${rotulo(rota)} → ${String(resposta.status)} ${String(codigo)}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('com senha provisória, só a troca de senha responde; o resto dá 403', async () => {
    const token = await tokenDe({ papel: 'ADMIN', provisoria: true });
    const liberadas = rotas.filter((rota) => rota.permiteSenhaProvisoria).map(rotulo);
    expect(liberadas).toEqual(['PATCH /auth/senha']);

    const falhas: string[] = [];
    for (const rota of rotas.filter((item) => !item.publica && !item.permiteSenhaProvisoria)) {
      const resposta = await chamar(rota, token);
      const codigo = (resposta.body as { error?: { code?: string } }).error?.code;
      if (resposta.status !== 403 || codigo !== 'TROCA_DE_SENHA_OBRIGATORIA') {
        falhas.push(`${rotulo(rota)} → ${String(resposta.status)} ${String(codigo)}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it('conta desativada perde o acesso na hora, mesmo com token ainda válido', async () => {
    const token = await tokenDe({ papel: 'MEMBRO' });
    await request(app.getHttpServer())
      .get('/api/v1/produtores')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { DataSource } = await import('typeorm');
    await app.get(DataSource).query('UPDATE usuarios SET ativo = false');

    await request(app.getHttpServer())
      .get('/api/v1/produtores')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});

describe('cabeçalhos e CORS', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('manda os cabeçalhos de segurança e esconde a tecnologia', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/health');

    expect(resposta.headers['x-powered-by']).toBeUndefined();
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['strict-transport-security']).toContain('max-age=');
    expect(resposta.headers['content-security-policy']).toContain("default-src 'self'");
    expect(resposta.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('só libera CORS para a origem configurada', async () => {
    const permitida = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST');
    const estranha = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://site-malicioso.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(permitida.headers['access-control-allow-credentials']).toBe('true');
    expect(estranha.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('recusa corpo acima do limite', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: '11987654321', senha: 'x'.repeat(200_000) });

    expect(resposta.status).toBe(413);
  });
});
