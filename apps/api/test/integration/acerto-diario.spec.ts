import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

const DIA = '2026-10-02';

interface Pedido {
  id: string;
  numero: number;
  pagamentos: { id: string }[];
}

interface Acerto {
  data: string;
  quantidadePedidos: number;
  unidades: number;
  valorMovimentadoCentavos: number;
  caixa: { pixCentavos: number; dinheiroCentavos: number; totalCentavos: number };
  fiado: { valorCentavos: number; pedidos: number[] };
  semPagamento: { valorCentavos: number; pedidos: number[] };
  totalProduzidoCentavos: number;
  produtores: {
    produtor: Ref;
    unidades: number;
    itens: {
      produto: Ref;
      preparo: string;
      centos: number;
      avulsas: number;
      valorCentavos: number;
    }[];
    valorItensCentavos: number;
    descontoCentavos: number;
    valorProduzidoCentavos: number;
  }[];
}

type Item = [produto: 'coxinha' | 'kibe', unidadeVenda: 'CENTO' | 'UNIDADE', quantidade: number];
type Forma = 'PIX' | 'DINHEIRO' | 'FIADO';

describe('acerto diário', () => {
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

  async function pedido(opcoes: {
    itens: Item[];
    descontoCentavos?: number;
    dataEntrega?: string;
    pagamentos?: [Forma, number][];
    status?: ('CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO')[];
  }): Promise<Pedido> {
    const criado = dadosDe<Pedido>(
      await api
        .post('/pedidos', {
          clienteId: cenario.ana.id,
          tipoEntrega: 'RETIRADA',
          dataEntrega: opcoes.dataEntrega ?? DIA,
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
        })
        .expect(201);
    }
    const [primeiro, ...depois] = opcoes.status ?? ['CONFIRMADO'];
    if (primeiro) await api.patch(`/pedidos/${criado.id}/status`, { status: primeiro }).expect(200);
    let atual = criado;
    for (const [forma, valorCentavos] of opcoes.pagamentos ?? []) {
      atual = dadosDe<Pedido>(
        await api.post(`/pedidos/${criado.id}/pagamentos`, { forma, valorCentavos }).expect(201),
      );
    }
    for (const status of depois) {
      await api.patch(`/pedidos/${criado.id}/status`, { status }).expect(200);
    }
    return atual;
  }

  function acerto(data = DIA): Promise<Acerto> {
    return api
      .get(`/relatorios/acerto?data=${data}`)
      .expect(200)
      .then((resposta) => dadosDe<Acerto>(resposta));
  }

  it('valida a data', async () => {
    const resposta = await api.get('/relatorios/acerto?data=2026-13-01').expect(400);
    expect(erroDe(resposta).code).toBe('VALIDATION_FAILED');
  });

  it('separa caixa, fiado e sem pagamento, e divide o caixa entre os produtores', async () => {
    // R$ 285,00 de coxinha e R$ 90,00 de kibe, com R$ 10,00 de desconto.
    const comDesconto = await pedido({
      itens: [
        ['coxinha', 'CENTO', 3],
        ['kibe', 'CENTO', 1],
      ],
      descontoCentavos: 1000,
      pagamentos: [
        ['PIX', 20000],
        ['DINHEIRO', 5000],
      ],
    });
    // R$ 60,00 de coxinha avulsa e R$ 180,00 de kibe, com fiado, já concluído.
    const comFiado = await pedido({
      itens: [
        ['coxinha', 'UNIDADE', 50],
        ['kibe', 'CENTO', 2],
      ],
      pagamentos: [['FIADO', 10000]],
      status: ['CONFIRMADO', 'CONCLUIDO'],
    });
    // Pagamento estornado não é caixa.
    const estornado = await pedido({ itens: [['kibe', 'CENTO', 1]], pagamentos: [['PIX', 9000]] });
    await api
      .delete(`/pedidos/${estornado.id}/pagamentos/${estornado.pagamentos[0]?.id ?? ''}`)
      .expect(200);
    // Fora do acerto: rascunho, cancelado e outro dia.
    await pedido({ itens: [['kibe', 'CENTO', 5]], status: [] });
    await pedido({ itens: [['kibe', 'CENTO', 5]], status: ['CONFIRMADO', 'CANCELADO'] });
    await pedido({
      itens: [['kibe', 'CENTO', 5]],
      dataEntrega: '2026-10-03',
      pagamentos: [['PIX', 100]],
    });

    const dia = await acerto();

    expect(dia).toMatchObject({
      data: DIA,
      quantidadePedidos: 3,
      unidades: 750,
      valorMovimentadoCentavos: 69500,
      caixa: { pixCentavos: 20000, dinheiroCentavos: 5000, totalCentavos: 25000 },
      fiado: { valorCentavos: 10000, pedidos: [comFiado.numero] },
      semPagamento: {
        valorCentavos: 34500,
        pedidos: [comDesconto.numero, comFiado.numero, estornado.numero],
      },
      totalProduzidoCentavos: 69500,
    });
    expect(dia).not.toHaveProperty('somaAReceberCentavos');
    expect(
      dia.produtores.map((parte) => ({
        nome: parte.produtor.nome,
        itens: parte.valorItensCentavos,
        desconto: parte.descontoCentavos,
        produzido: parte.valorProduzidoCentavos,
      })),
    ).toEqual([
      // R$ 90,00 + R$ 180,00 + R$ 90,00 de kibe, menos R$ 2,40 do desconto.
      {
        nome: 'Célia',
        itens: 36000,
        desconto: 240,
        produzido: 35760,
      },
      // R$ 285,00 + R$ 60,00 de coxinha, menos R$ 7,60 do desconto.
      {
        nome: 'Mira',
        itens: 34500,
        desconto: 760,
        produzido: 33740,
      },
    ]);
    expect(dia.produtores[1]?.itens).toEqual([
      {
        produto: { id: cenario.coxinha.id, nome: 'Coxinha de frango' },
        preparo: 'FRITO',
        centos: 3,
        avulsas: 50,
        valorCentavos: 34500,
      },
    ]);
  });

  it('dia sem encomendas responde zerado', async () => {
    const dia = await acerto('2026-12-25');

    expect(dia).toMatchObject({
      quantidadePedidos: 0,
      valorMovimentadoCentavos: 0,
      caixa: { totalCentavos: 0 },
      produtores: [],
    });
  });
});
