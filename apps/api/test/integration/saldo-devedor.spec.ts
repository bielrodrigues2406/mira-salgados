import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Cenario, montarCenario } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Pedido {
  id: string;
  numero: number;
  resumo: { saldoDevedorCentavos: number };
}

interface ClienteDetalhe {
  saldoDevedorCentavos: number;
  temFiado: boolean;
  quantidadePedidosComSaldo: number;
  pedidosComSaldo: { numero: number; dataEntrega: string; saldoDevedorCentavos: number }[];
}

describe('saldo devedor do cliente', () => {
  let app: NestExpressApplication;
  let api: ClienteHttp;
  let cenario: Cenario;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    api = await clienteAutenticado(app);
    cenario = await montarCenario(api);
  });

  afterAll(async () => {
    await app.close();
  });

  async function pedidoCom(
    dataEntrega: string,
    centos: number,
    status: 'RASCUNHO' | 'CONFIRMADO' | 'CONCLUIDO',
    extras: object = {},
  ): Promise<Pedido> {
    const pedido = dadosDe<Pedido>(
      await api
        .post('/pedidos', {
          clienteId: cenario.ana.id,
          tipoEntrega: 'RETIRADA',
          dataEntrega,
          ...extras,
        })
        .expect(201),
    );
    await api
      .post(`/pedidos/${pedido.id}/itens`, {
        produtoId: cenario.coxinha.id,
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        quantidade: centos,
      })
      .expect(201);
    if (status !== 'RASCUNHO') {
      await api.patch(`/pedidos/${pedido.id}/status`, { status: 'CONFIRMADO' }).expect(200);
    }
    if (status === 'CONCLUIDO') {
      await api.patch(`/pedidos/${pedido.id}/status`, { status: 'CONCLUIDO' }).expect(200);
    }
    return pedido;
  }

  it('soma o saldo dos pedidos confirmados e concluídos, igual ao detalhe de cada um', async () => {
    const antigo = await pedidoCom('2026-09-20', 2, 'CONCLUIDO', { descontoCentavos: 1000 });
    const recente = await pedidoCom('2026-10-01', 1, 'CONFIRMADO');
    const quitado = await pedidoCom('2026-09-25', 1, 'CONFIRMADO');
    await pedidoCom('2026-10-05', 3, 'RASCUNHO');

    await api
      .post(`/pedidos/${antigo.id}/pagamentos`, { forma: 'PIX', valorCentavos: 5000 })
      .expect(201);
    await api
      .post(`/pedidos/${antigo.id}/pagamentos`, { forma: 'FIADO', valorCentavos: 13000 })
      .expect(201);
    await api
      .post(`/pedidos/${quitado.id}/pagamentos`, { forma: 'DINHEIRO', valorCentavos: 9500 })
      .expect(201);

    const saldos = await Promise.all(
      [antigo, recente, quitado].map(
        async (pedido) =>
          dadosDe<Pedido>(await api.get(`/pedidos/${pedido.id}`)).resumo.saldoDevedorCentavos,
      ),
    );
    const detalhe = dadosDe<ClienteDetalhe>(
      await api.get(`/clientes/${cenario.ana.id}`).expect(200),
    );
    const lista = dadosDe<{ saldoDevedorCentavos: number; temFiado: boolean }[]>(
      await api.get('/clientes').expect(200),
    );

    expect(saldos).toEqual([13000, 9500, 0]);
    expect(detalhe).toMatchObject({
      saldoDevedorCentavos: 22500,
      temFiado: true,
      quantidadePedidosComSaldo: 2,
      pedidosComSaldo: [
        { numero: antigo.numero, dataEntrega: '2026-09-20', saldoDevedorCentavos: 13000 },
        { numero: recente.numero, dataEntrega: '2026-10-01', saldoDevedorCentavos: 9500 },
      ],
    });
    expect(lista[0]).toMatchObject({ saldoDevedorCentavos: 22500, temFiado: true });
  });

  it('cliente sem pedidos em vigor tem saldo zero', async () => {
    await pedidoCom('2026-10-05', 1, 'RASCUNHO');

    const detalhe = dadosDe<ClienteDetalhe>(
      await api.get(`/clientes/${cenario.ana.id}`).expect(200),
    );

    expect(detalhe).toMatchObject({
      saldoDevedorCentavos: 0,
      temFiado: false,
      pedidosComSaldo: [],
    });
  });
});
