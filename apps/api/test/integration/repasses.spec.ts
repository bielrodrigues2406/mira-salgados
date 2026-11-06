import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe, metaDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Saldo {
  produtor: Ref & { ativo: boolean };
  aReceberCentavos: number;
  recebidoCentavos: number;
  faltaCentavos: number;
}

interface Saldos {
  data: string;
  produtores: Saldo[];
  totais: { aReceberCentavos: number; recebidoCentavos: number; faltaCentavos: number };
}

interface Repasse {
  id: string;
  produtor: Ref;
  valorCentavos: number;
  forma: 'PIX' | 'DINHEIRO';
  data: string;
  observacao: string | null;
  registradoPor: Ref;
  desfeitoEm: string | null;
  desfeitoPor: Ref | null;
}

describe('repasses e saldos dos produtores', () => {
  let app: NestExpressApplication;
  let api: ClienteHttp;
  let cenario: Cenario;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    // Membro, não administrador: qualquer conta registra repasses.
    api = await clienteAutenticado(app, 'MEMBRO');
    cenario = await montarCenario(api);
  });

  afterAll(async () => {
    await app.close();
  });

  async function pedido(
    dataEntrega: string,
    itens: ['coxinha' | 'kibe', number][],
    opcoes: { confirmar?: boolean; fiado?: number } = {},
  ): Promise<void> {
    const criado = dadosDe<{ id: string }>(
      await api
        .post('/pedidos', { clienteId: cenario.ana.id, tipoEntrega: 'RETIRADA', dataEntrega })
        .expect(201),
    );
    for (const [produto, quantidade] of itens) {
      await api
        .post(`/pedidos/${criado.id}/itens`, {
          produtoId: cenario[produto].id,
          preparo: 'FRITO',
          unidadeVenda: 'CENTO',
          quantidade,
        })
        .expect(201);
    }
    if (opcoes.confirmar === false) return;
    await api.patch(`/pedidos/${criado.id}/status`, { status: 'CONFIRMADO' }).expect(200);
    if (opcoes.fiado) {
      await api
        .post(`/pedidos/${criado.id}/pagamentos`, { forma: 'FIADO', valorCentavos: opcoes.fiado })
        .expect(201);
    }
  }

  async function saldos(data = '2026-10-05'): Promise<Saldos> {
    return dadosDe<Saldos>(await api.get(`/relatorios/saldos?data=${data}`).expect(200));
  }

  function saldoDe(todos: Saldos, produtor: Ref): Omit<Saldo, 'produtor'> {
    const saldo = todos.produtores.find((s) => s.produtor.id === produtor.id);
    if (!saldo) throw new Error(`Sem saldo de ${produtor.nome}`);
    const { produtor: _produtor, ...valores } = saldo;
    return valores;
  }

  function repassar(produtor: Ref, valorCentavos: number, extra: object = {}) {
    return api.post('/repasses', {
      produtorId: produtor.id,
      valorCentavos,
      forma: 'PIX',
      data: '2026-10-05',
      ...extra,
    });
  }

  it('exige autenticação', async () => {
    const servidor = app.getHttpServer();
    await request(servidor).get('/api/v1/repasses').expect(401);
    await request(servidor).get('/api/v1/relatorios/saldos?data=2026-10-05').expect(401);
  });

  it('a receber é o que cada um fez até a data, fiado incluído; rascunho e futuro, não', async () => {
    await pedido(
      '2026-10-02',
      [
        ['coxinha', 2],
        ['kibe', 1],
      ],
      { fiado: 28000 },
    );
    await pedido('2026-10-03', [['coxinha', 1]], { confirmar: false });
    await pedido('2026-10-10', [['kibe', 3]]);

    const todos = await saldos();

    expect(saldoDe(todos, cenario.mira)).toEqual({
      aReceberCentavos: 19000,
      recebidoCentavos: 0,
      faltaCentavos: 19000,
    });
    expect(saldoDe(todos, cenario.celia)).toEqual({
      aReceberCentavos: 9000,
      recebidoCentavos: 0,
      faltaCentavos: 9000,
    });
    expect(todos.totais).toEqual({
      aReceberCentavos: 28000,
      recebidoCentavos: 0,
      faltaCentavos: 28000,
    });
    // O pedido do dia 10 entra quando a data chega.
    expect(saldoDe(await saldos('2026-10-10'), cenario.celia).aReceberCentavos).toBe(36000);
  });

  it('repasse abate o que falta; adiantado fica negativo; desfazer devolve', async () => {
    await pedido('2026-10-02', [
      ['coxinha', 2],
      ['kibe', 1],
    ]);

    const parcial = dadosDe<Repasse>(
      await repassar(cenario.mira, 10000, { observacao: '  metade da semana  ' }).expect(201),
    );
    expect(parcial).toMatchObject({
      produtor: { id: cenario.mira.id, nome: 'Mira' },
      valorCentavos: 10000,
      forma: 'PIX',
      data: '2026-10-05',
      observacao: 'metade da semana',
      registradoPor: { id: api.usuarioId },
      desfeitoEm: null,
    });
    await repassar(cenario.celia, 10000, { forma: 'DINHEIRO' }).expect(201);

    let todos = await saldos();
    expect(saldoDe(todos, cenario.mira)).toEqual({
      aReceberCentavos: 19000,
      recebidoCentavos: 10000,
      faltaCentavos: 9000,
    });
    expect(saldoDe(todos, cenario.celia).faltaCentavos).toBe(-1000);

    const desfeito = dadosDe<Repasse>(await api.delete(`/repasses/${parcial.id}`).expect(200));
    expect(desfeito.desfeitoEm).not.toBeNull();
    expect(desfeito.desfeitoPor?.id).toBe(api.usuarioId);
    expect(erroDe(await api.delete(`/repasses/${parcial.id}`).expect(422)).code).toBe(
      'REPASSE_DESFEITO',
    );

    todos = await saldos();
    expect(saldoDe(todos, cenario.mira).faltaCentavos).toBe(19000);

    // O desfeito continua no histórico.
    const lista = await api.get(`/repasses?produtorId=${cenario.mira.id}`).expect(200);
    expect(metaDe(lista)?.total).toBe(1);
    expect(dadosDe<Repasse[]>(lista)[0]?.desfeitoEm).not.toBeNull();
  });

  it('valida valor, forma, data e produtor', async () => {
    await repassar(cenario.mira, 0).expect(400);
    await repassar(cenario.mira, 10.5).expect(400);
    await repassar(cenario.mira, 100, { forma: 'FIADO' }).expect(400);
    await repassar(cenario.mira, 100, { data: '2026-02-30' }).expect(400);
    await repassar(cenario.mira, 100, { observacao: 'x'.repeat(201) }).expect(400);
    const inexistente = await api
      .post('/repasses', {
        produtorId: '00000000-0000-4000-8000-000000000000',
        valorCentavos: 100,
        forma: 'PIX',
        data: '2026-10-05',
      })
      .expect(422);
    expect(erroDe(inexistente).code).toBe('PRODUTOR_INVALIDO');
    await api.delete('/repasses/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('registrar e desfazer ficam na auditoria em nome de quem fez', async () => {
    const repasse = dadosDe<Repasse>(await repassar(cenario.mira, 5000).expect(201));
    await api.delete(`/repasses/${repasse.id}`).expect(200);

    const registros = await app
      .get(DataSource)
      .getRepository(LogAuditoria)
      .find({ where: { entidade: 'repasse', entidadeId: repasse.id }, order: { criadoEm: 'ASC' } });
    expect(registros.map((r) => [r.acao, r.usuarioId])).toEqual([
      ['CRIACAO', api.usuarioId],
      ['ESTORNO', api.usuarioId],
    ]);
  });
});
