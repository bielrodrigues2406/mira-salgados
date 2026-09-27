import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AuditoriaService } from '../../src/auditoria/auditoria.service.js';
import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { Usuario } from '../../src/usuarios/usuario.entity.js';
import { criarUsuario, novoIp, SENHA_PADRAO } from './helpers/auth.js';
import { limparBanco } from './helpers/database.js';
import { createTestApp } from './helpers/test-app.js';

describe('auditoria', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra a criação de usuário sem o hash da senha', async () => {
    const usuario = await criarUsuario(app);

    const logs = await app.get(DataSource).getRepository(LogAuditoria).find();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entidade: 'usuario',
      entidadeId: usuario.id,
      acao: 'CRIACAO',
      dadosAntes: null,
      usuarioId: null,
    });
    expect(logs[0]?.dadosDepois).toMatchObject({ email: 'lucia@exemplo.com' });
    expect(JSON.stringify(logs[0]?.dadosDepois)).not.toMatch(/senha|argon2/i);
  });

  it('lista os registros com paginação e filtros para usuário autenticado', async () => {
    await criarUsuario(app);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ email: 'lucia@exemplo.com', senha: SENHA_PADRAO });
    const { accessToken } = (login.body as { data: { accessToken: string } }).data;

    const resposta = await request(app.getHttpServer())
      .get('/api/v1/auditoria')
      .query({ entidade: 'usuario', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({
      data: [{ entidade: 'usuario', acao: 'CRIACAO' }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  describe('com falha na gravação do log', () => {
    let appComFalha: NestExpressApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AuditoriaService)
        .useValue({
          registrar: () => Promise.reject(new Error('falha simulada ao gravar auditoria')),
        })
        .compile();
      appComFalha = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
      configureApp(appComFalha);
      await appComFalha.init();
    });

    afterAll(async () => {
      await appComFalha.close();
    });

    it('desfaz a operação auditada: log e alteração são atômicos', async () => {
      await expect(criarUsuario(appComFalha)).rejects.toThrow('falha simulada');

      const usuarios = await app.get(DataSource).getRepository(Usuario).count();
      expect(usuarios).toBe(0);
    });
  });
});
