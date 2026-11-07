import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import {
  type ClienteHttp,
  clienteAutenticado,
  dadosDe,
  erroDe,
  metaDe,
  resumoDe,
} from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Pedido {
  id: string;
  numero: number;
}

type Item = [produto: 'coxinha' | 'kibe', unidadeVenda: 'CENTO' | 'UNIDADE', quantidade: number];
type Forma = 'PIX' | 'DINHEIRO' | 'FIADO';

describe('relatórios de período e fiados', () => {
  let app: NestExpressApplication;
  let api: ClienteHttp;
  let cenario: Cenario;
  let bruno: Ref;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    api = await clienteAutenticado(app);
    cenario = await montarCenario(api);
    bruno = dadosDe<Ref>(
      await api.post('/clientes', { nome: 'Bruno Carvalho', telefone: '11990001111' }).expect(201),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function pedido(opcoes: {
    dataEntrega: string;
    itens: Item[];
    cliente?: Ref;
    descontoCentavos?: number;
    pagamentos?: [Forma, number][];
    rascunho?: boolean;
    produtorId?: string;
  }): Promise<Pedido> {
    const criado = dadosDe<Pedido>(
      await api
        .post('/pedidos', {
          clienteId: (opcoes.cliente ?? cenario.ana).id,
          tipoEntrega: 'RETIRADA',
          dataEntrega: opcoes.dataEntrega,
          descontoCentavos: opcoes.descontoCentavos ?? 0,
        })
        .expect(201),
    );
    for (const [produto, unidadeVenda, quantidade] of opcoes.itens) {
      await api
        .post(`/pedidos/${criado.id}/itens`, {
          produtoId: cenario[produto].id,
          preparo: 'FRITO',
          unidadeVenda,
          quantidade,
          ...(opcoes.produtorId ? { produtorId: opcoes.produtorId } : {}),
        })
        .expect(201);
    }
    if (!opcoes.rascunho) {
      await api.patch(`/pedidos/${criado.id}/status`, { status: 'CONFIRMADO' }).expect(200);
    }
    for (const [forma, valorCentavos] of opcoes.pagamentos ?? []) {
      await api.post(`/pedidos/${criado.id}/pagamentos`, { forma, valorCentavos }).expect(201);
    }
    return criado;
  }

  describe('intervalo', () => {
    it('exige de e ate, com ate a partir de de e no máximo um ano', async () => {
      for (const consulta of [
        '',
        '?de=2026-10-01',
        '?de=2026-10-05&ate=2026-10-01',
        '?de=2026-01-01&ate=2027-01-02',
        '?de=2026-02-30&ate=2026-03-01',
      ]) {
        const resposta = await api.get(`/relatorios/faturamento${consulta}`).expect(400);
        expect(erroDe(resposta).code).toBe('VALIDATION_FAILED');
      }
      await api.get('/relatorios/faturamento?de=2026-01-01&ate=2027-01-01').expect(200);
      await api.get('/relatorios/faturamento?de=2026-10-01&ate=2026-10-01').expect(200);
    });
  });

  it('fatura por dia os pedidos em vigor, com desconto, recebido e fiado', async () => {
    // R$ 190,00 - R$ 10,00, PIX de R$ 100,00.
    await pedido({
      dataEntrega: '2026-10-01',
      itens: [['coxinha', 'CENTO', 2]],
      descontoCentavos: 1000,
      pagamentos: [['PIX', 10000]],
    });
    // R$ 90,00 + R$ 60,00, dinheiro de R$ 50,00 e fiado de R$ 40,00.
    await pedido({
      dataEntrega: '2026-10-03',
      itens: [
        ['kibe', 'CENTO', 1],
        ['coxinha', 'UNIDADE', 50],
      ],
      pagamentos: [
        ['DINHEIRO', 5000],
        ['FIADO', 4000],
      ],
    });
    await pedido({ dataEntrega: '2026-10-03', itens: [['kibe', 'CENTO', 1]] });
    await pedido({ dataEntrega: '2026-10-03', itens: [['kibe', 'CENTO', 9]], rascunho: true });
    await pedido({ dataEntrega: '2026-10-09', itens: [['kibe', 'CENTO', 9]] });

    const resposta = await api
      .get('/relatorios/faturamento?de=2026-10-01&ate=2026-10-07')
      .expect(200);

    expect(dadosDe(resposta)).toEqual({
      de: '2026-10-01',
      ate: '2026-10-07',
      quantidadePedidos: 3,
      unidades: 450,
      faturamentoCentavos: 42000,
      descontosCentavos: 1000,
      recebidoCentavos: 15000,
      fiadoCentavos: 4000,
      aReceberCentavos: 27000,
      ticketMedioCentavos: 14000,
      porDia: [
        { data: '2026-10-01', quantidadePedidos: 1, faturamentoCentavos: 18000 },
        { data: '2026-10-03', quantidadePedidos: 2, faturamentoCentavos: 24000 },
      ],
    });
  });

  it('ordena os itens vendidos por unidades, paginados, com o volume do período', async () => {
    await pedido({ dataEntrega: '2026-10-01', itens: [['coxinha', 'CENTO', 3]] });
    await pedido({
      dataEntrega: '2026-10-02',
      itens: [
        ['kibe', 'CENTO', 1],
        ['coxinha', 'UNIDADE', 50],
      ],
    });

    const primeira = await api
      .get('/relatorios/itens-vendidos?de=2026-10-01&ate=2026-10-31&pageSize=1')
      .expect(200);
    expect(dadosDe(primeira)).toEqual([
      {
        posicao: 1,
        produto: { id: cenario.coxinha.id, nome: 'Coxinha de frango' },
        preparo: 'FRITO',
        unidades: 350,
        valorCentavos: 34500,
        quantidadePedidos: 2,
      },
    ]);
    expect(metaDe(primeira)).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(resumoDe(primeira)).toEqual({ unidades: 450, valorCentavos: 43500 });

    const segunda = await api
      .get('/relatorios/itens-vendidos?de=2026-10-01&ate=2026-10-31&pageSize=1&page=2')
      .expect(200);
    expect(
      dadosDe<{ posicao: number; produto: Ref }[]>(segunda).map((i) => [i.posicao, i.produto.nome]),
    ).toEqual([[2, 'Kibe']]);
  });

  it('agrega a produção por produtor, com filtro por produtor', async () => {
    // R$ 5,00 de desconto: sai do que a Mira tem a receber, não do valor dos itens.
    await pedido({
      dataEntrega: '2026-10-01',
      itens: [['coxinha', 'CENTO', 3]],
      descontoCentavos: 500,
    });
    await pedido({ dataEntrega: '2026-10-02', itens: [['kibe', 'CENTO', 2]] });
    // Coxinha feita pela Célia neste pedido: conta para ela, não para a Mira.
    await pedido({
      dataEntrega: '2026-10-02',
      itens: [['coxinha', 'CENTO', 1]],
      produtorId: cenario.celia.id,
    });

    const todos = await api.get('/relatorios/producao?de=2026-10-01&ate=2026-10-31').expect(200);
    expect(
      dadosDe<
        {
          produtor: Ref;
          unidades: number;
          valorCentavos: number;
          aReceberCentavos: number;
          quantidadePedidos: number;
          itens: { produto: Ref; unidades: number }[];
        }[]
      >(todos).map((p) => [
        p.produtor.nome,
        p.unidades,
        p.valorCentavos,
        p.aReceberCentavos,
        p.quantidadePedidos,
        p.itens.map((i) => [i.produto.nome, i.unidades]),
      ]),
    ).toEqual([
      [
        'Célia',
        300,
        27500,
        27500,
        2,
        [
          ['Kibe', 200],
          ['Coxinha de frango', 100],
        ],
      ],
      ['Mira', 300, 28500, 28000, 1, [['Coxinha de frango', 300]]],
    ]);
    expect(resumoDe(todos)).toEqual({
      unidades: 600,
      valorCentavos: 56000,
      aReceberCentavos: 55500,
    });

    const mira = await api
      .get(`/relatorios/producao?de=2026-10-01&ate=2026-10-31&produtorId=${cenario.mira.id}`)
      .expect(200);
    expect(dadosDe<{ produtor: Ref }[]>(mira).map((p) => p.produtor.nome)).toEqual(['Mira']);
    expect(metaDe(mira)?.total).toBe(1);
    expect(resumoDe(mira)).toMatchObject({ aReceberCentavos: 28000 });
  });

  describe('fiados', () => {
    it('lista o fiado em aberto por cliente, limitado ao que ainda falta receber', async () => {
      // Fiado de R$ 190,00; depois R$ 50,00 em PIX: restam R$ 140,00 em aberto.
      const antigo = await pedido({
        dataEntrega: '2026-09-20',
        itens: [['coxinha', 'CENTO', 2]],
        pagamentos: [
          ['FIADO', 19000],
          ['PIX', 5000],
        ],
      });
      const recente = await pedido({
        dataEntrega: '2026-10-01',
        itens: [['kibe', 'CENTO', 1]],
        pagamentos: [['FIADO', 3000]],
      });
      // Fiado quitado depois em dinheiro: sai da relação.
      await pedido({
        dataEntrega: '2026-09-25',
        itens: [['kibe', 'CENTO', 1]],
        pagamentos: [
          ['FIADO', 9000],
          ['DINHEIRO', 9000],
        ],
      });
      await pedido({
        dataEntrega: '2026-10-02',
        itens: [['kibe', 'CENTO', 3]],
        cliente: bruno,
        pagamentos: [['FIADO', 27000]],
      });
      // Saldo sem fiado não é fiado.
      await pedido({ dataEntrega: '2026-10-02', itens: [['kibe', 'CENTO', 1]], cliente: bruno });

      const resposta = await api.get('/relatorios/fiados').expect(200);

      expect(dadosDe(resposta)).toEqual([
        {
          cliente: { id: bruno.id, nome: 'Bruno Carvalho', telefone: '11990001111' },
          emAbertoCentavos: 27000,
          desde: '2026-10-02',
          pedidos: [
            expect.objectContaining({ dataEntrega: '2026-10-02', emAbertoCentavos: 27000 }),
          ],
        },
        {
          cliente: { id: cenario.ana.id, nome: 'Ana Paula Ribeiro', telefone: null },
          emAbertoCentavos: 17000,
          desde: '2026-09-20',
          pedidos: [
            {
              id: antigo.id,
              numero: antigo.numero,
              dataEntrega: '2026-09-20',
              emAbertoCentavos: 14000,
            },
            {
              id: recente.id,
              numero: recente.numero,
              dataEntrega: '2026-10-01',
              emAbertoCentavos: 3000,
            },
          ],
        },
      ]);
      expect(metaDe(resposta)?.total).toBe(2);
      expect(resumoDe(resposta)).toEqual({ totalEmAbertoCentavos: 44000, quantidadePedidos: 3 });

      const daAna = await api.get(`/relatorios/fiados?clienteId=${cenario.ana.id}`).expect(200);
      expect(dadosDe<{ cliente: Ref }[]>(daAna).map((f) => f.cliente.nome)).toEqual([
        'Ana Paula Ribeiro',
      ]);
      expect(resumoDe(daAna)).toEqual({ totalEmAbertoCentavos: 17000, quantidadePedidos: 2 });
    });

    it('recusa cliente inválido', async () => {
      await api.get('/relatorios/fiados?clienteId=abc').expect(400);
    });
  });
});
