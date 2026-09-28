import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { criarUsuario, novoIp, SENHA_PADRAO } from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

// O mesmo segredo de test-env.ts: permite montar tokens "quase válidos" e
// provar que cada verificação (algoritmo, emissor, audiência, validade,
// conta) barra sozinha. Em produção o segredo nunca sai do servidor.
const SEGREDO = 'segredo-exclusivo-dos-testes-de-integracao-0123456789';
const EMISSOR = 'mira-salgados-api';
const AUDIENCIA = 'mira-salgados-web';

function base64url(valor: object): string {
  return Buffer.from(JSON.stringify(valor)).toString('base64url');
}

describe('ataques a tokens e a privilégios', () => {
  let app: NestExpressApplication;
  const jwt = new JwtService();

  let admin: { id: string; token: string };
  let membro: { id: string; telefone: string; token: string };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    admin = await entrar('ADMIN');
    membro = await entrar('MEMBRO');
  });

  afterAll(async () => {
    await app.close();
  });

  async function entrar(
    papel: 'ADMIN' | 'MEMBRO',
  ): Promise<{ id: string; telefone: string; token: string }> {
    const usuario = await criarUsuario(app, { papel });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: usuario.telefone, senha: SENHA_PADRAO })
      .expect(200);
    return {
      id: usuario.id,
      telefone: usuario.telefone ?? '',
      token: dadosDe<{ accessToken: string }>(login).accessToken,
    };
  }

  function comToken(token: string, caminho = '/api/v1/usuarios'): request.Test {
    return request(app.getHttpServer()).get(caminho).set('Authorization', `Bearer ${token}`);
  }

  function assinar(payload: object, opcoes: Parameters<JwtService['sign']>[1] = {}): string {
    return jwt.sign(payload, {
      secret: SEGREDO,
      algorithm: 'HS256',
      issuer: EMISSOR,
      audience: AUDIENCIA,
      expiresIn: 900,
      ...opcoes,
    });
  }

  describe('tokens forjados', () => {
    it('"alg: none" com o id do administrador é recusado', async () => {
      const agora = Math.floor(Date.now() / 1000);
      const semAssinatura = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
        sub: admin.id,
        iss: EMISSOR,
        aud: AUDIENCIA,
        iat: agora,
        exp: agora + 900,
      })}.`;

      await comToken(semAssinatura).expect(401);
    });

    it('assinado com outro segredo é recusado', async () => {
      const token = jwt.sign(
        { sub: admin.id },
        { secret: 'x'.repeat(48), algorithm: 'HS256', issuer: EMISSOR, audience: AUDIENCIA },
      );

      await comToken(token).expect(401);
    });

    it('troca de algoritmo no cabeçalho (HS512, RS256) é recusada', async () => {
      const hs512 = jwt.sign(
        { sub: admin.id },
        { secret: SEGREDO, algorithm: 'HS512', issuer: EMISSOR, audience: AUDIENCIA },
      );
      const [, corpo, assinatura] = assinar({ sub: admin.id }).split('.');
      const rs256 = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${corpo ?? ''}.${assinatura ?? ''}`;

      await comToken(hs512).expect(401);
      await comToken(rs256).expect(401);
    });

    it('trocar o sub de um token válido quebra a assinatura', async () => {
      const [cabecalho, corpo, assinatura] = membro.token.split('.');
      const dados = JSON.parse(Buffer.from(corpo ?? '', 'base64url').toString()) as object;
      const adulterado = `${cabecalho ?? ''}.${base64url({ ...dados, sub: admin.id })}.${assinatura ?? ''}`;

      await comToken(adulterado).expect(401);
    });

    it('emissor ou audiência de outro sistema são recusados', async () => {
      await comToken(assinar({ sub: admin.id }, { issuer: 'outro-sistema' })).expect(401);
      await comToken(assinar({ sub: admin.id }, { audience: 'outro-app' })).expect(401);
    });

    it('token expirado é recusado', async () => {
      const agora = Math.floor(Date.now() / 1000);
      const expirado = jwt.sign(
        { sub: admin.id, iat: agora - 3600, exp: agora - 60 },
        { secret: SEGREDO, algorithm: 'HS256', issuer: EMISSOR, audience: AUDIENCIA },
      );

      await comToken(expirado).expect(401);
    });

    it('token de conta inexistente ou com sub inválido é recusado', async () => {
      await comToken(assinar({ sub: '00000000-0000-4000-8000-000000000000' })).expect(401);
      await comToken(assinar({ sub: "' OR 1=1 --" })).expect(401);
      await comToken(assinar({})).expect(401);
    });

    it('papel escrito no token não vale: a permissão vem do banco', async () => {
      const comPapel = assinar({ sub: membro.id, papel: 'ADMIN', role: 'admin', admin: true });

      const resposta = await comToken(comPapel);

      expect(resposta.status).toBe(403);
      expect(erroDe(resposta).code).toBe('SOMENTE_ADMIN');
    });

    it('access token não serve como refresh token, nem refresh como access', async () => {
      const refreshComAccess = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', novoIp())
        .set('Cookie', `mira_refresh=${membro.token}`);
      expect(refreshComAccess.status).toBe(401);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: membro.telefone, senha: SENHA_PADRAO });
      const cookie = (login.headers['set-cookie'] as unknown as string[])
        .find((valor) => valor.startsWith('mira_refresh='))
        ?.split(';')[0]
        ?.replace('mira_refresh=', '');
      await comToken(cookie ?? '', '/api/v1/produtores').expect(401);
    });
  });

  describe('escalonamento de privilégio', () => {
    it('membro não se promove nem altera ninguém', async () => {
      const promover = await request(app.getHttpServer())
        .patch(`/api/v1/usuarios/${membro.id}`)
        .set('Authorization', `Bearer ${membro.token}`)
        .send({ papel: 'ADMIN' });
      const redefinir = await request(app.getHttpServer())
        .post(`/api/v1/usuarios/${admin.id}/senha`)
        .set('Authorization', `Bearer ${membro.token}`)
        .send({ senha: 'senha-nova-do-invasor' });

      expect(promover.status).toBe(403);
      expect(redefinir.status).toBe(403);
    });

    it('a troca da própria senha não aceita papel nem outra conta no corpo', async () => {
      const resposta = await request(app.getHttpServer())
        .patch('/api/v1/auth/senha')
        .set('X-Forwarded-For', novoIp())
        .set('Authorization', `Bearer ${membro.token}`)
        .send({
          senhaAtual: SENHA_PADRAO,
          novaSenha: 'outra-senha-bem-longa',
          papel: 'ADMIN',
          usuarioId: admin.id,
        });

      expect(resposta.status).toBe(400);
      expect(erroDe(resposta).code).toBe('VALIDATION_FAILED');
    });

    it('criar conta não aceita definir campos internos (senha já trocada, id, ativo)', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          nome: 'Nova',
          telefone: '11912340000',
          papel: 'MEMBRO',
          senha: 'senha-provisoria-longa',
          trocarSenha: false,
          id: '00000000-0000-4000-8000-000000000000',
        });

      expect(resposta.status).toBe(400);
    });

    it('rebaixar um administrador tira o acesso na hora, sem esperar o token expirar', async () => {
      const outroAdmin = await entrar('ADMIN');
      await comToken(outroAdmin.token).expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/usuarios/${outroAdmin.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ papel: 'MEMBRO' })
        .expect(200);

      const depois = await comToken(outroAdmin.token);
      expect(depois.status).toBe(403);
    });

    it('senha redefinida pelo administrador derruba as sessões da pessoa', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', novoIp())
        .send({ telefone: membro.telefone, senha: SENHA_PADRAO });
      const cookie = (login.headers['set-cookie'] as unknown as string[]).find((valor) =>
        valor.startsWith('mira_refresh='),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/usuarios/${membro.id}/senha`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ senha: 'senha-provisoria-longa' })
        .expect(200);

      // O access token de 15 minutos passa a esbarrar na troca obrigatória de senha.
      const comAccess = await comToken(membro.token, '/api/v1/produtores');
      expect(comAccess.status).toBe(403);
      expect(erroDe(comAccess).code).toBe('TROCA_DE_SENHA_OBRIGATORIA');
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', novoIp())
        .set('Cookie', cookie?.split(';')[0] ?? '')
        .expect(401);
    });

    it('ids malformados nas rotas dão 400, sem chegar ao banco', async () => {
      const resposta = await request(app.getHttpServer())
        .patch("/api/v1/usuarios/1' OR '1'='1")
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ nome: 'x' });

      expect(resposta.status).toBe(400);
    });
  });
});
