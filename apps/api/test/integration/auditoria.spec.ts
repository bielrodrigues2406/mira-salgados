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
import { clienteAutenticado, dadosDe } from './helpers/http.js';
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
    expect(logs[0]?.dadosDepois).toMatchObject({ nome: 'Lúcia Andrade', papel: 'MEMBRO' });
    expect(JSON.stringify(logs[0]?.dadosDepois)).not.toMatch(/"senha(Hash)?"|argon2/i);
  });

  async function tokenDe(papel: 'ADMIN' | 'MEMBRO'): Promise<string> {
    const usuario = await criarUsuario(app, { papel });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', novoIp())
      .send({ telefone: usuario.telefone, senha: SENHA_PADRAO });
    return (login.body as { data: { accessToken: string } }).data.accessToken;
  }

  it('lista os registros com paginação e filtros para administrador', async () => {
    const accessToken = await tokenDe('ADMIN');

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

  it('recusa membro com 403: o histórico mostra dados de todas as áreas', async () => {
    const accessToken = await tokenDe('MEMBRO');

    const resposta = await request(app.getHttpServer())
      .get('/api/v1/auditoria')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(resposta.status).toBe(403);
    expect((resposta.body as { error: { code: string } }).error.code).toBe('SOMENTE_ADMIN');
  });

  it('traz quem fez e o nome dos registros citados, com filtro por ação e autor', async () => {
    const admin = await clienteAutenticado(app, 'ADMIN');
    const produtor = dadosDe<{ id: string }>(
      await admin.post('/produtores', { nome: 'Célia' }).expect(201),
    );
    const produto = dadosDe<{ id: string }>(
      await admin.post('/produtos', { nome: 'Kibe', produtorPadraoId: produtor.id }).expect(201),
    );
    await admin.patch(`/produtos/${produto.id}`, { nome: 'Kibe de carne' }).expect(200);

    const resposta = await admin
      .get(`/auditoria?entidade=produto&acao=ATUALIZACAO&usuarioId=${admin.usuarioId}`)
      .expect(200);
    const logs = dadosDe<
      {
        acao: string;
        autor: { id: string; nome: string } | null;
        referencias: Record<string, string>;
      }[]
    >(resposta);

    expect(logs).toHaveLength(1);
    expect(logs[0]?.autor).toEqual({ id: admin.usuarioId, nome: 'Lúcia Andrade' });
    expect(logs[0]?.referencias).toEqual({
      [produto.id]: 'Kibe de carne',
      [produtor.id]: 'Célia',
    });

    const deOutraPessoa = await admin
      .get('/auditoria?usuarioId=00000000-0000-4000-8000-000000000000')
      .expect(200);
    expect(dadosDe<unknown[]>(deOutraPessoa)).toHaveLength(0);
    expect((await admin.get('/auditoria?acao=INVENTADA')).status).toBe(400);
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
