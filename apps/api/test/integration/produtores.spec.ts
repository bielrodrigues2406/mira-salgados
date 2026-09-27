import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe, metaDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Produtor {
  id: string;
  nome: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

describe('produtores', () => {
  let app: NestExpressApplication;
  let api: ClienteHttp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    api = await clienteAutenticado(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function criar(nome: string): Promise<Produtor> {
    return dadosDe<Produtor>(await api.post('/produtores', { nome }).expect(201));
  }

  it('exige autenticação', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/produtores');
    expect(resposta.status).toBe(401);
  });

  it('cadastra com nome aparado e responde sem campos internos', async () => {
    const resposta = await api.post('/produtores', { nome: '  Célia  ' }).expect(201);

    expect(Object.keys(dadosDe<Produtor>(resposta)).sort()).toEqual(
      ['ativo', 'atualizadoEm', 'criadoEm', 'id', 'nome'].sort(),
    );
    expect(dadosDe<Produtor>(resposta)).toMatchObject({ nome: 'Célia', ativo: true });
  });

  it('recusa nome repetido sem distinção de maiúsculas', async () => {
    await criar('Mira');

    const resposta = await api.post('/produtores', { nome: 'MIRA' });

    expect(resposta.status).toBe(409);
    expect(erroDe(resposta)).toMatchObject({
      code: 'PRODUTOR_JA_EXISTE',
      message: 'Já existe um produtor com este nome.',
    });
  });

  it('recusa nome vazio, longo demais e propriedades extras', async () => {
    const vazio = await api.post('/produtores', { nome: '   ' });
    const longo = await api.post('/produtores', { nome: 'x'.repeat(81) });
    const extra = await api.post('/produtores', { nome: 'Rafael', ativo: false });

    expect([vazio.status, longo.status, extra.status]).toEqual([400, 400, 400]);
    expect(erroDe(extra).details).toEqual([
      { field: 'ativo', messages: ['O campo "ativo" não é permitido.'] },
    ]);
  });

  it('lista ativos primeiro, em ordem alfabética do português, com paginação', async () => {
    const nair = await criar('Nair');
    await criar('Rafael');
    await criar('Célia');
    await criar('Cláudio');
    await api.patch(`/produtores/${nair.id}`, { ativo: false }).expect(200);

    const primeira = await api.get('/produtores?pageSize=3').expect(200);
    const segunda = await api.get('/produtores?pageSize=3&page=2').expect(200);

    expect(dadosDe<Produtor[]>(primeira).map((p) => p.nome)).toEqual([
      'Célia',
      'Cláudio',
      'Rafael',
    ]);
    expect(dadosDe<Produtor[]>(segunda).map((p) => p.nome)).toEqual(['Nair']);
    expect(metaDe(primeira)).toEqual({ page: 1, pageSize: 3, total: 4, totalPages: 2 });
  });

  it('filtra por situação e recusa filtro inválido', async () => {
    const nair = await criar('Nair');
    await criar('Rafael');
    await api.patch(`/produtores/${nair.id}`, { ativo: false }).expect(200);

    const ativos = await api.get('/produtores?ativo=true').expect(200);
    const inativos = await api.get('/produtores?ativo=false').expect(200);
    const invalido = await api.get('/produtores?ativo=sim');

    expect(dadosDe<Produtor[]>(ativos).map((p) => p.nome)).toEqual(['Rafael']);
    expect(dadosDe<Produtor[]>(inativos).map((p) => p.nome)).toEqual(['Nair']);
    expect(invalido.status).toBe(400);
  });

  it('busca por id, com 404 para inexistente e 400 para id malformado', async () => {
    const mira = await criar('Mira');

    const encontrado = await api.get(`/produtores/${mira.id}`).expect(200);
    const inexistente = await api.get(`/produtores/${crypto.randomUUID()}`);
    const malformado = await api.get('/produtores/nao-e-uuid');

    expect(dadosDe<Produtor>(encontrado).nome).toBe('Mira');
    expect(inexistente.status).toBe(404);
    expect(erroDe(inexistente).message).toBe('Produtor não encontrado.');
    expect(malformado.status).toBe(400);
  });

  it('renomeia, inclusive trocando só maiúsculas, e recusa nome de outro produtor', async () => {
    const mira = await criar('mira');
    await criar('Célia');

    const renomeado = await api.patch(`/produtores/${mira.id}`, { nome: 'Mira' }).expect(200);
    const conflito = await api.patch(`/produtores/${mira.id}`, { nome: 'célia' });

    expect(dadosDe<Produtor>(renomeado).nome).toBe('Mira');
    expect(conflito.status).toBe(409);
  });

  it('audita criação, renomeação, desativação e reativação com o autor', async () => {
    const produtor = await criar('Nair');
    await api.patch(`/produtores/${produtor.id}`, { nome: 'Nair Souza' }).expect(200);
    await api.patch(`/produtores/${produtor.id}`, { ativo: false }).expect(200);
    await api.patch(`/produtores/${produtor.id}`, { ativo: true }).expect(200);

    const logs = await app
      .get(DataSource)
      .getRepository(LogAuditoria)
      .find({ where: { entidade: 'produtor' }, order: { criadoEm: 'ASC' } });

    expect(logs.map((log) => log.acao)).toEqual([
      'CRIACAO',
      'ATUALIZACAO',
      'DESATIVACAO',
      'ATUALIZACAO',
    ]);
    expect(logs.every((log) => log.usuarioId === api.usuarioId)).toBe(true);
    expect(logs[1]?.dadosAntes).toMatchObject({ nome: 'Nair' });
    expect(logs[1]?.dadosDepois).toMatchObject({ nome: 'Nair Souza' });
  });

  it('não grava nem audita atualização sem mudança', async () => {
    const produtor = await criar('Rafael');

    await api.patch(`/produtores/${produtor.id}`, { nome: 'Rafael', ativo: true }).expect(200);

    const logs = await app.get(DataSource).getRepository(LogAuditoria).countBy({
      entidade: 'produtor',
    });
    expect(logs).toBe(1);
  });

  it('responde 409 com a mensagem de negócio em cadastros simultâneos do mesmo nome', async () => {
    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => api.post('/produtores', { nome: 'Joana' })),
    );

    const status = respostas.map((resposta) => resposta.status).sort();
    expect(status).toEqual([201, 409, 409, 409, 409]);
    for (const resposta of respostas.filter((r) => r.status === 409)) {
      expect(erroDe(resposta).code).toBe('PRODUTOR_JA_EXISTE');
    }
  });
});
