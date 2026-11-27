import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditoriaService } from '../../src/auditoria/auditoria.service.js';
import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { ChaveIdempotencia } from '../../src/pedidos/chave-idempotencia.entity.js';
import { ItemPedido } from '../../src/pedidos/itens/item-pedido.entity.js';
import { Pedido } from '../../src/pedidos/pedido.entity.js';
import { type Cenario, montarCenario } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface PedidoCriado {
  id: string;
  numero: number;
  status: string;
  tipoEntrega: string;
  enderecoEntrega: string | null;
  itens: { id: string; quantidade: number; subtotalCentavos: number }[];
  resumo: { subtotalCentavos: number; descontoCentavos: number; totalCentavos: number };
}

describe('encomenda confirmada atômica (POST /pedidos/confirmados)', () => {
  let app: NestExpressApplication;
  let admin: ClienteHttp;
  let membro: ClienteHttp;
  let cenario: Cenario;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    admin = await clienteAutenticado(app, 'ADMIN');
    membro = await clienteAutenticado(app, 'MEMBRO');
    cenario = await montarCenario(admin);
  });

  afterAll(async () => {
    await app.close();
  });

  function payloadBase(extras: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      clienteId: cenario.ana.id,
      tipoEntrega: 'ENTREGA',
      dataEntrega: '2026-10-02',
      horarioEntrega: '18:30',
      itens: [
        {
          produtoId: cenario.coxinha.id,
          preparo: 'FRITO',
          unidadeVenda: 'CENTO',
          quantidade: 1,
        },
      ],
      ...extras,
    };
  }

  it('exige autenticação e permite Idempotency-Key no CORS', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pedidos/confirmados')
      .send(payloadBase())
      .expect(401);

    const preflight = await request(app.getHttpServer())
      .options('/api/v1/pedidos/confirmados')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type, Idempotency-Key');

    expect(preflight.headers['access-control-allow-headers']).toContain('Idempotency-Key');
  });

  it('cria pedido confirmado, itens e auditoria numa única transação e já aparece na produção e acerto', async () => {
    await admin
      .patch(`/clientes/${cenario.ana.id}`, { endereco: 'Rua das Flores, 10' })
      .expect(200);

    const criado = dadosDe<PedidoCriado>(
      await admin
        .post('/pedidos/confirmados', payloadBase({ descontoCentavos: 500 }))
        .set('Idempotency-Key', 'tentativa-001')
        .expect(201),
    );

    expect(criado.status).toBe('CONFIRMADO');
    expect(criado.enderecoEntrega).toBe('Rua das Flores, 10');
    expect(criado.itens).toHaveLength(1);
    expect(criado.resumo).toMatchObject({
      subtotalCentavos: 9500,
      descontoCentavos: 500,
      totalCentavos: 9000,
    });

    const producao = dadosDe<{ quantidadePedidos: number; unidades: number }>(
      await admin.get('/relatorios/producao-do-dia?data=2026-10-02').expect(200),
    );
    expect(producao).toMatchObject({ quantidadePedidos: 1, unidades: 100 });

    const acerto = dadosDe<{ unidades: number; valorMovimentadoCentavos: number }>(
      await admin.get('/relatorios/acerto?data=2026-10-02').expect(200),
    );
    expect(acerto).toMatchObject({ unidades: 100, valorMovimentadoCentavos: 9000 });

    const logs = await app
      .get(DataSource)
      .getRepository(LogAuditoria)
      .find({ where: { entidadeId: criado.id } });
    expect(logs.map((log) => log.acao)).toEqual(['CRIACAO']);
  });

  it('mantém a regressão de duas linhas de meio cento a R$ 95,01 somando R$ 95,02 e 100 unidades', async () => {
    await admin
      .post(`/produtos/${cenario.coxinha.id}/precos`, {
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        precoCentavos: 9501,
      })
      .expect(201);

    const criado = dadosDe<PedidoCriado>(
      await admin
        .post(
          '/pedidos/confirmados',
          payloadBase({
            itens: [
              {
                produtoId: cenario.coxinha.id,
                preparo: 'FRITO',
                unidadeVenda: 'CENTO',
                quantidade: 0.5,
              },
              {
                produtoId: cenario.coxinha.id,
                preparo: 'FRITO',
                unidadeVenda: 'CENTO',
                quantidade: 0.5,
              },
            ],
          }),
        )
        .expect(201),
    );

    expect(criado.itens).toHaveLength(2);
    expect(criado.itens.map((item) => item.subtotalCentavos)).toEqual([4751, 4751]);
    expect(criado.resumo.subtotalCentavos).toBe(9502);
    expect(criado.resumo.totalCentavos).toBe(9502);

    const producao = dadosDe<{ unidades: number }>(
      await admin.get('/relatorios/producao-do-dia?data=2026-10-02').expect(200),
    );
    expect(producao.unidades).toBe(100);

    const acerto = dadosDe<{ unidades: number; totalProduzidoCentavos: number }>(
      await admin.get('/relatorios/acerto?data=2026-10-02').expect(200),
    );
    expect(acerto).toMatchObject({ unidades: 100, totalProduzidoCentavos: 9502 });
  });

  it('valida tudo antes de gravar: falha no segundo item ou desconto excedente não grava nada nem queima número', async () => {
    const semItens = await admin.post('/pedidos/confirmados', payloadBase({ itens: [] }));
    expect(semItens.status).toBe(400);

    const descontoAlto = await admin.post(
      '/pedidos/confirmados',
      payloadBase({ descontoCentavos: 10000 }),
    );
    expect(descontoAlto.status).toBe(422);
    expect(erroDe(descontoAlto).code).toBe('DESCONTO_MAIOR_QUE_SUBTOTAL');

    const segundoInvalido = await admin
      .post(
        '/pedidos/confirmados',
        payloadBase({
          itens: [
            {
              produtoId: cenario.coxinha.id,
              preparo: 'FRITO',
              unidadeVenda: 'CENTO',
              quantidade: 1,
            },
            {
              produtoId: cenario.coxinha.id,
              preparo: 'ASSADO',
              unidadeVenda: 'CENTO',
              quantidade: 1,
            },
          ],
        }),
      )
      .set('Idempotency-Key', 'chave-apos-erro');
    expect(segundoInvalido.status).toBe(422);
    expect(erroDe(segundoInvalido).code).toBe('PRECO_INEXISTENTE');

    const ds = app.get(DataSource);
    expect(await ds.getRepository(Pedido).count()).toBe(0);
    expect(await ds.getRepository(ItemPedido).count()).toBe(0);
    expect(await ds.getRepository(ChaveIdempotencia).count()).toBe(0);

    // Chave não foi consumida na falha e a sequência continua em #1.
    const primeiroValido = dadosDe<PedidoCriado>(
      await admin
        .post('/pedidos/confirmados', payloadBase())
        .set('Idempotency-Key', 'chave-apos-erro')
        .expect(201),
    );
    expect(primeiroValido.numero).toBe(1);
  });

  it('reverte pedido, itens e chave de idempotência se a auditoria falhar', async () => {
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('falha simulada na auditoria'));

    try {
      const resposta = await admin
        .post('/pedidos/confirmados', payloadBase())
        .set('Idempotency-Key', 'chave-rollback');
      expect(resposta.status).toBe(500);
    } finally {
      spy.mockRestore();
    }

    const ds = app.get(DataSource);
    expect(await ds.getRepository(Pedido).count()).toBe(0);
    expect(await ds.getRepository(ItemPedido).count()).toBe(0);
    expect(await ds.getRepository(ChaveIdempotencia).count()).toBe(0);
  });

  describe('idempotência', () => {
    it('repetição sequencial e duplo clique simultâneo devolvem o mesmo pedido sem duplicar', async () => {
      const corpo = payloadBase();
      const [r1, r2] = await Promise.all([
        admin.post('/pedidos/confirmados', corpo).set('Idempotency-Key', 'duplo-clique-1'),
        admin.post('/pedidos/confirmados', corpo).set('Idempotency-Key', 'duplo-clique-1'),
      ]);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      const p1 = dadosDe<PedidoCriado>(r1);
      const p2 = dadosDe<PedidoCriado>(r2);
      expect(p1.id).toBe(p2.id);
      expect(p1.numero).toBe(p2.numero);

      const r3 = await admin
        .post('/pedidos/confirmados', corpo)
        .set('Idempotency-Key', 'duplo-clique-1')
        .expect(201);
      expect(dadosDe<PedidoCriado>(r3).id).toBe(p1.id);
      expect(await app.get(DataSource).getRepository(Pedido).count()).toBe(1);
    });

    it('rejeita com 409 a mesma chave reaproveitada com dados diferentes', async () => {
      await admin
        .post('/pedidos/confirmados', payloadBase({ descontoCentavos: 0 }))
        .set('Idempotency-Key', 'chave-reusada')
        .expect(201);

      const conflito = await admin
        .post('/pedidos/confirmados', payloadBase({ descontoCentavos: 100 }))
        .set('Idempotency-Key', 'chave-reusada');

      expect(conflito.status).toBe(409);
      expect(erroDe(conflito).code).toBe('CHAVE_IDEMPOTENCIA_CONFLITANTE');
      expect(await app.get(DataSource).getRepository(Pedido).count()).toBe(1);
    });

    it('isola chaves de idempotência por usuário e valida formato da chave', async () => {
      const doAdmin = dadosDe<PedidoCriado>(
        await admin
          .post('/pedidos/confirmados', payloadBase())
          .set('Idempotency-Key', 'mesma-chave')
          .expect(201),
      );
      const doMembro = dadosDe<PedidoCriado>(
        await membro
          .post('/pedidos/confirmados', payloadBase({ descontoCentavos: 500 }))
          .set('Idempotency-Key', 'mesma-chave')
          .expect(201),
      );

      expect(doMembro.id).not.toBe(doAdmin.id);

      const invalida = await admin
        .post('/pedidos/confirmados', payloadBase())
        .set('Idempotency-Key', 'chave com espaco');
      expect(invalida.status).toBe(422);
      expect(erroDe(invalida).code).toBe('CHAVE_IDEMPOTENCIA_INVALIDA');
    });
  });

  it('painel conta rascunhos legados de datas anteriores durante a transição', async () => {
    await admin
      .post('/pedidos', {
        clienteId: cenario.ana.id,
        tipoEntrega: 'RETIRADA',
        dataEntrega: '2026-09-10',
      })
      .expect(201);

    const painel = dadosDe<{ familia: { rascunhos: number } }>(
      await admin.get('/painel?data=2026-10-01').expect(200),
    );
    expect(painel.familia.rascunhos).toBe(1);
  });
});
