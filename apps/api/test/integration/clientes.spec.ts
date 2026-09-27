import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe, metaDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

describe('clientes', () => {
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

  async function criar(dados: Partial<Cliente> & { nome: string }): Promise<Cliente> {
    return dadosDe<Cliente>(await api.post('/clientes', dados).expect(201));
  }

  async function buscar(termo: string): Promise<string[]> {
    const resposta = await api.get(`/clientes?busca=${encodeURIComponent(termo)}`).expect(200);
    return dadosDe<Cliente[]>(resposta).map((cliente) => cliente.nome);
  }

  it('exige autenticação', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/clientes');
    expect(resposta.status).toBe(401);
  });

  it('cadastra guardando só os dígitos do telefone e sem endereço vazio', async () => {
    const cliente = await criar({
      nome: ' Ana Paula Ribeiro ',
      telefone: '(11) 99134-2280',
      endereco: '  ',
    });

    expect(cliente).toMatchObject({
      nome: 'Ana Paula Ribeiro',
      telefone: '11991342280',
      endereco: null,
      ativo: true,
    });
    expect(Object.keys(cliente).sort()).toEqual(
      ['ativo', 'atualizadoEm', 'criadoEm', 'endereco', 'id', 'nome', 'telefone'].sort(),
    );
  });

  it('aceita cliente só com nome', async () => {
    const cliente = await criar({ nome: 'Fernanda Castro' });

    expect(cliente).toMatchObject({ telefone: null, endereco: null });
  });

  it('recusa telefone sem DDD, nome vazio e propriedades extras', async () => {
    const semDdd = await api.post('/clientes', { nome: 'Carla', telefone: '9913-2280' });
    const semNome = await api.post('/clientes', { nome: ' ' });
    const extra = await api.post('/clientes', { nome: 'Carla', saldo: 10 });

    expect([semDdd.status, semNome.status, extra.status]).toEqual([400, 400, 400]);
    expect(erroDe(semDdd).details).toEqual([
      { field: 'telefone', messages: ['O campo "telefone" está em formato inválido.'] },
    ]);
    expect(erroDe(extra).details).toEqual([
      { field: 'saldo', messages: ['O campo "saldo" não é permitido.'] },
    ]);
  });

  it('busca pelo nome sem distinção de maiúsculas nem acentos', async () => {
    await criar({ nome: 'Célia Menezes' });
    await criar({ nome: 'Escola Pequeno Príncipe' });
    await criar({ nome: 'Roberto Lima' });

    expect(await buscar('celia')).toEqual(['Célia Menezes']);
    expect(await buscar('PRINCIPE')).toEqual(['Escola Pequeno Príncipe']);
    expect(await buscar('e')).toEqual(['Célia Menezes', 'Escola Pequeno Príncipe', 'Roberto Lima']);
  });

  it('busca pelo telefone com ou sem máscara, mas não por números no meio do nome', async () => {
    await criar({ nome: 'Juliana Torres', telefone: '11981550932' });
    await criar({ nome: 'Escola 2', telefone: '1130214455' });

    expect(await buscar('(11) 98155')).toEqual(['Juliana Torres']);
    expect(await buscar('0932')).toEqual(['Juliana Torres']);
    expect(await buscar('Escola 2')).toEqual(['Escola 2']);
  });

  it('trata curingas do LIKE como texto literal', async () => {
    await criar({ nome: 'Buffet Sabor & Arte' });
    await criar({ nome: 'Buffet 100% Caseiro' });

    expect(await buscar('%')).toEqual(['Buffet 100% Caseiro']);
    expect(await buscar('_')).toEqual([]);
  });

  it('pagina em ordem alfabética do português e filtra por situação', async () => {
    const carla = await criar({ nome: 'Carla' });
    await criar({ nome: 'Álvaro' });
    await criar({ nome: 'Bruno' });
    await api.patch(`/clientes/${carla.id}`, { ativo: false }).expect(200);

    const primeira = await api.get('/clientes?pageSize=2').expect(200);
    const ativos = await api.get('/clientes?ativo=true').expect(200);

    expect(dadosDe<Cliente[]>(primeira).map((c) => c.nome)).toEqual(['Álvaro', 'Bruno']);
    expect(metaDe(primeira)).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(dadosDe<Cliente[]>(ativos).map((c) => c.nome)).toEqual(['Álvaro', 'Bruno']);
  });

  it('atualiza, apaga telefone com null e audita desativação', async () => {
    const cliente = await criar({ nome: 'Roberto', telefone: '11996407781' });

    const alterado = await api
      .patch(`/clientes/${cliente.id}`, {
        nome: 'Roberto Lima',
        telefone: null,
        endereco: 'Rua Apinajés, 300',
      })
      .expect(200);
    await api.patch(`/clientes/${cliente.id}`, { ativo: false }).expect(200);

    expect(dadosDe<Cliente>(alterado)).toMatchObject({
      nome: 'Roberto Lima',
      telefone: null,
      endereco: 'Rua Apinajés, 300',
    });
    const logs = await app
      .get(DataSource)
      .getRepository(LogAuditoria)
      .find({ where: { entidade: 'cliente' }, order: { criadoEm: 'ASC' } });
    expect(logs.map((log) => log.acao)).toEqual(['CRIACAO', 'ATUALIZACAO', 'DESATIVACAO']);
    expect(logs[1]?.dadosAntes).toMatchObject({ telefone: '11996407781' });
    expect(logs.every((log) => log.usuarioId === api.usuarioId)).toBe(true);
  });

  it('responde 404 para cliente inexistente', async () => {
    const resposta = await api.patch(`/clientes/${crypto.randomUUID()}`, { nome: 'X' });

    expect(resposta.status).toBe(404);
    expect(erroDe(resposta).message).toBe('Cliente não encontrado.');
  });
});
