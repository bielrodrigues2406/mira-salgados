import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

const DIA = '2026-10-02';

interface Pedido {
  id: string;
  numero: number;
}

interface Item {
  id: string;
}

interface ProducaoDoDia {
  data: string;
  quantidadePedidos: number;
  quantidadeProdutores: number;
  unidades: number;
  porPreparo: { preparo: string; unidades: number }[];
  faixas: {
    horario: string | null;
    unidades: number;
    pedidos: {
      numero: number;
      status: string;
      cliente: Ref;
      unidades: number;
      itens: {
        produto: Ref;
        produtor: Ref;
        unidadeVenda: string;
        quantidade: number;
        unidades: number;
      }[];
    }[];
  }[];
  consolidado: {
    preparo: string;
    unidades: number;
    linhas: {
      produto: Ref;
      produtor: Ref;
      unidades: number;
      centos: number;
      avulsas: number;
      pedidos: number[];
    }[];
  }[];
}

type NovoItem = [produto: Ref, unidadeVenda: 'CENTO' | 'UNIDADE', quantidade: number];

describe('produção do dia', () => {
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

  async function pedido(
    dados: { dataEntrega?: string; horarioEntrega?: string },
    itens: NovoItem[],
    status: ('CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO')[] = ['CONFIRMADO'],
  ): Promise<Pedido & { itens: Item[] }> {
    const criado = dadosDe<Pedido>(
      await api
        .post('/pedidos', {
          clienteId: cenario.ana.id,
          tipoEntrega: 'RETIRADA',
          dataEntrega: DIA,
          ...dados,
        })
        .expect(201),
    );
    const criados: Item[] = [];
    for (const [produto, unidadeVenda, quantidade] of itens) {
      const agregado = dadosDe<{ itens: Item[] }>(
        await api
          .post(`/pedidos/${criado.id}/itens`, {
            produtoId: produto.id,
            preparo: 'FRITO',
            unidadeVenda,
            quantidade,
          })
          .expect(201),
      );
      const ultimo = agregado.itens.at(-1);
      if (!ultimo) throw new Error('Item não criado.');
      criados.push(ultimo);
    }
    for (const passo of status) {
      await api.patch(`/pedidos/${criado.id}/status`, { status: passo }).expect(200);
    }
    return { ...criado, itens: criados };
  }

  function producao(data = DIA): Promise<ProducaoDoDia> {
    return api
      .get(`/relatorios/producao-do-dia?data=${data}`)
      .expect(200)
      .then((resposta) => dadosDe<ProducaoDoDia>(resposta));
  }

  it('exige autenticação', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/relatorios/producao-do-dia?data=${DIA}`)
      .expect(401);
  });

  it('valida a data', async () => {
    for (const consulta of ['', '?data=2026-02-30', '?data=02/10/2026']) {
      const resposta = await api.get(`/relatorios/producao-do-dia${consulta}`).expect(400);
      expect(erroDe(resposta).code).toBe('VALIDATION_FAILED');
    }
  });

  it('conta só pedidos confirmados e concluídos da data, por horário e sem horário no fim', async () => {
    const semHorario = await pedido({}, [[cenario.kibe, 'CENTO', 2]]);
    const tarde = await pedido(
      { horarioEntrega: '15:00' },
      [[cenario.coxinha, 'UNIDADE', 50]],
      ['CONFIRMADO', 'CONCLUIDO'],
    );
    const manha = await pedido({ horarioEntrega: '10:00' }, [
      [cenario.kibe, 'CENTO', 1],
      [cenario.coxinha, 'CENTO', 3],
    ]);
    await pedido({ horarioEntrega: '09:00' }, [[cenario.coxinha, 'CENTO', 9]], []);
    await pedido(
      { horarioEntrega: '09:00' },
      [[cenario.coxinha, 'CENTO', 9]],
      ['CONFIRMADO', 'CANCELADO'],
    );
    await pedido({ dataEntrega: '2026-10-03' }, [[cenario.coxinha, 'CENTO', 9]]);

    const dia = await producao();

    expect(dia).toMatchObject({
      data: DIA,
      quantidadePedidos: 3,
      quantidadeProdutores: 2,
      unidades: 650,
      porPreparo: [
        { preparo: 'FRITO', unidades: 650 },
        { preparo: 'ASSADO', unidades: 0 },
        { preparo: 'CONGELADO', unidades: 0 },
      ],
      porProdutor: [
        { produtor: { id: cenario.mira.id, nome: 'Mira' }, unidades: 350 },
        { produtor: { id: cenario.celia.id, nome: 'Célia' }, unidades: 300 },
      ],
    });
    expect(dia.faixas.map((faixa) => [faixa.horario, faixa.unidades])).toEqual([
      ['10:00', 400],
      ['15:00', 50],
      [null, 200],
    ]);
    expect(dia.faixas.map((faixa) => faixa.pedidos.map((p) => [p.numero, p.status]))).toEqual([
      [[manha.numero, 'CONFIRMADO']],
      [[tarde.numero, 'CONCLUIDO']],
      [[semHorario.numero, 'CONFIRMADO']],
    ]);
    // Itens do pedido em ordem de preparo e nome do produto.
    expect(
      dia.faixas[0]?.pedidos[0]?.itens.map((item) => [
        item.produto.nome,
        item.produtor.nome,
        item.unidades,
      ]),
    ).toEqual([
      ['Coxinha de frango', 'Mira', 300],
      ['Kibe', 'Célia', 100],
    ]);
    expect(dia.faixas[0]?.pedidos[0]?.cliente).toEqual({
      id: cenario.ana.id,
      nome: 'Ana Paula Ribeiro',
    });

    expect(dia.consolidado).toEqual([
      {
        preparo: 'FRITO',
        unidades: 650,
        linhas: [
          {
            produto: { id: cenario.coxinha.id, nome: 'Coxinha de frango' },
            produtor: { id: cenario.mira.id, nome: 'Mira' },
            unidades: 350,
            centos: 3,
            avulsas: 50,
            pedidos: [tarde.numero, manha.numero].sort((a, b) => a - b),
          },
          {
            produto: { id: cenario.kibe.id, nome: 'Kibe' },
            produtor: { id: cenario.celia.id, nome: 'Célia' },
            unidades: 300,
            centos: 3,
            avulsas: 0,
            pedidos: [semHorario.numero, manha.numero],
          },
        ],
      },
    ]);
  });

  it('atribui o item ao produtor escolhido nele, não ao padrão do produto', async () => {
    const encomenda = await pedido(
      { horarioEntrega: '11:00' },
      [[cenario.coxinha, 'CENTO', 2]],
      [],
    );
    await api
      .patch(`/pedidos/${encomenda.id}/itens/${encomenda.itens[0]?.id ?? ''}`, {
        produtorId: cenario.celia.id,
      })
      .expect(200);
    await api.patch(`/pedidos/${encomenda.id}/status`, { status: 'CONFIRMADO' }).expect(200);

    const dia = await producao();

    expect(dia.quantidadeProdutores).toBe(1);
    expect(dia.consolidado[0]?.linhas.map((linha) => linha.produtor.nome)).toEqual(['Célia']);
  });

  it('dia sem encomendas responde vazio, sem erro', async () => {
    const dia = await producao('2026-12-25');

    expect(dia).toMatchObject({ quantidadePedidos: 0, unidades: 0, faixas: [], consolidado: [] });
  });
});
