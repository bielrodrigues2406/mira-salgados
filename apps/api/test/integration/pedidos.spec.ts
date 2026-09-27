import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { type Cenario, montarCenario } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe, metaDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Pedido {
  id: string;
  numero: number;
  status: string;
  statusPagamento: string;
  tipoEntrega: string;
  dataEntrega: string;
  horarioEntrega: string | null;
  resumo: {
    subtotalCentavos: number;
    descontoCentavos: number;
    totalCentavos: number;
    totalPagoCentavos: number;
    totalFiadoCentavos: number;
    saldoDevedorCentavos: number;
  };
  itens: {
    id: string;
    produto: { nome: string };
    produtor: { id: string; nome: string };
    produtorPadrao: { nome: string };
    quantidade: number;
    precoUnitarioCentavos: number;
    subtotalCentavos: number;
  }[];
  pagamentos: { id: string; forma: string; valorCentavos: number; estornadoEm: string | null }[];
  transicoesPermitidas: string[];
}

describe('pedidos', () => {
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

  async function novoPedido(dados: object = {}): Promise<Pedido> {
    const corpo = {
      clienteId: cenario.ana.id,
      tipoEntrega: 'RETIRADA',
      dataEntrega: '2026-10-02',
      ...dados,
    };
    return dadosDe<Pedido>(await api.post('/pedidos', corpo).expect(201));
  }

  async function adicionarItem(pedido: Pedido, dados: object): Promise<Pedido> {
    const corpo = {
      produtoId: cenario.coxinha.id,
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      quantidade: 1,
      ...dados,
    };
    return dadosDe<Pedido>(await api.post(`/pedidos/${pedido.id}/itens`, corpo).expect(201));
  }

  function mudarStatus(pedido: Pedido, status: string) {
    return api.patch(`/pedidos/${pedido.id}/status`, { status });
  }

  function pagar(pedido: Pedido, forma: string, valorCentavos: number) {
    return api.post(`/pedidos/${pedido.id}/pagamentos`, { forma, valorCentavos });
  }

  it('exige autenticação', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/pedidos');
    expect(resposta.status).toBe(401);
  });

  it('cria rascunho numerado, sem itens e com transições possíveis', async () => {
    const primeiro = await novoPedido({ horarioEntrega: '11:30' });
    const segundo = await novoPedido();

    expect(primeiro).toMatchObject({
      status: 'RASCUNHO',
      statusPagamento: 'PAGO',
      horarioEntrega: '11:30',
      itens: [],
      transicoesPermitidas: ['CONFIRMADO', 'CANCELADO'],
    });
    expect(segundo.numero).toBe(primeiro.numero + 1);
  });

  it('valida entrada: data inexistente, horário, cliente inativo e propriedades extras', async () => {
    const base = { clienteId: cenario.ana.id, tipoEntrega: 'RETIRADA' };
    const data = await api.post('/pedidos', { ...base, dataEntrega: '2026-02-30' });
    const horario = await api.post('/pedidos', {
      ...base,
      dataEntrega: '2026-10-02',
      horarioEntrega: '25:00',
    });
    const extra = await api.post('/pedidos', {
      ...base,
      dataEntrega: '2026-10-02',
      status: 'CONCLUIDO',
    });
    await api.patch(`/clientes/${cenario.ana.id}`, { ativo: false }).expect(200);
    const inativo = await api.post('/pedidos', { ...base, dataEntrega: '2026-10-02' });

    expect([data.status, horario.status, extra.status, inativo.status]).toEqual([
      400, 400, 400, 422,
    ]);
    expect(erroDe(extra).details).toEqual([
      { field: 'status', messages: ['O campo "status" não é permitido.'] },
    ]);
    expect(erroDe(inativo).code).toBe('CLIENTE_INVALIDO');
  });

  it('recusa taxa de entrega e entregador: entrega não tem efeito financeiro', async () => {
    const resposta = await api.post('/pedidos', {
      clienteId: cenario.ana.id,
      tipoEntrega: 'ENTREGA',
      dataEntrega: '2026-10-02',
      taxaEntregaCentavos: 1000,
      entregadorId: cenario.celia.id,
    });

    expect(resposta.status).toBe(400);
    expect(erroDe(resposta).details).toEqual([
      {
        field: 'taxaEntregaCentavos',
        messages: ['O campo "taxaEntregaCentavos" não é permitido.'],
      },
      { field: 'entregadorId', messages: ['O campo "entregadorId" não é permitido.'] },
    ]);
  });

  it('copia o preço vigente e o produtor padrão para o item', async () => {
    const pedido = await novoPedido();

    const comItem = await adicionarItem(pedido, { quantidade: 3 });
    await api
      .post(`/produtos/${cenario.coxinha.id}/precos`, {
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        precoCentavos: 10000,
      })
      .expect(201);
    const depois = dadosDe<Pedido>(await api.get(`/pedidos/${pedido.id}`).expect(200));

    expect(comItem.itens[0]).toMatchObject({
      produto: { nome: 'Coxinha de frango' },
      produtor: { id: cenario.mira.id, nome: 'Mira' },
      precoUnitarioCentavos: 9500,
      subtotalCentavos: 28500,
    });
    expect(depois.itens[0]?.precoUnitarioCentavos).toBe(9500);
  });

  it('permite trocar o produtor do item e mantém a referência ao padrão', async () => {
    const pedido = await adicionarItem(await novoPedido(), { produtorId: cenario.celia.id });
    const item = pedido.itens[0];
    if (!item) throw new Error('item não criado');

    const alterado = dadosDe<Pedido>(
      await api
        .patch(`/pedidos/${pedido.id}/itens/${item.id}`, {
          produtorId: cenario.mira.id,
          quantidade: 2,
        })
        .expect(200),
    );

    expect(pedido.itens[0]).toMatchObject({
      produtor: { nome: 'Célia' },
      produtorPadrao: { nome: 'Mira' },
    });
    expect(alterado.itens[0]).toMatchObject({
      produtor: { nome: 'Mira' },
      quantidade: 2,
      subtotalCentavos: 19000,
    });
  });

  it('recusa combinação sem preço vigente e produto inativo', async () => {
    const pedido = await novoPedido();

    const semPreco = await api.post(`/pedidos/${pedido.id}/itens`, {
      produtoId: cenario.kibe.id,
      preparo: 'ASSADO',
      unidadeVenda: 'CENTO',
      quantidade: 1,
    });
    await api.patch(`/produtos/${cenario.kibe.id}`, { ativo: false }).expect(200);
    const inativo = await api.post(`/pedidos/${pedido.id}/itens`, {
      produtoId: cenario.kibe.id,
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      quantidade: 1,
    });

    expect(semPreco.status).toBe(422);
    expect(erroDe(semPreco)).toMatchObject({
      code: 'PRECO_INEXISTENTE',
      message: 'Kibe não tem preço vigente para Assado · Cento.',
    });
    expect(erroDe(inativo).code).toBe('PRODUTO_INVALIDO');
  });

  it('calcula totais com desconto, igual para entrega e retirada', async () => {
    let pedido = await novoPedido({ tipoEntrega: 'ENTREGA', descontoCentavos: 2000 });
    await adicionarItem(pedido, { quantidade: 3 });
    pedido = await adicionarItem(pedido, { produtoId: cenario.kibe.id, quantidade: 1 });

    expect(pedido.tipoEntrega).toBe('ENTREGA');
    expect(pedido.resumo).toEqual({
      subtotalCentavos: 37500,
      descontoCentavos: 2000,
      totalCentavos: 35500,
      totalPagoCentavos: 0,
      totalFiadoCentavos: 0,
      saldoDevedorCentavos: 35500,
    });
    expect(pedido.statusPagamento).toBe('PENDENTE');
  });

  describe('transições de status', () => {
    it('confirma só com itens e registra a transição na auditoria da mesma operação', async () => {
      const pedido = await novoPedido();

      const semItens = await mudarStatus(pedido, 'CONFIRMADO');
      await adicionarItem(pedido, {});
      const confirmado = await mudarStatus(pedido, 'CONFIRMADO');

      expect(semItens.status).toBe(422);
      expect(erroDe(semItens).code).toBe('PEDIDO_SEM_ITENS');
      expect(confirmado.status).toBe(200);
      expect(dadosDe<Pedido>(confirmado).transicoesPermitidas).toEqual(['CONCLUIDO', 'CANCELADO']);

      const logs = await app.get(DataSource).getRepository(LogAuditoria).findBy({
        entidade: 'pedido',
        entidadeId: pedido.id,
        acao: 'TRANSICAO_STATUS',
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.dadosAntes).toMatchObject({ status: 'RASCUNHO' });
      expect(logs[0]?.dadosDepois).toMatchObject({ status: 'CONFIRMADO' });
      expect(logs[0]?.usuarioId).toBe(api.usuarioId);
    });

    it('recusa transição fora da máquina de estados', async () => {
      const pedido = await adicionarItem(await novoPedido(), {});

      const pulando = await mudarStatus(pedido, 'CONCLUIDO');

      expect(pulando.status).toBe(422);
      expect(erroDe(pulando)).toMatchObject({
        code: 'TRANSICAO_INVALIDA',
        message: 'Um pedido rascunho não pode passar para concluído.',
      });
    });

    it('trata concluído como terminal: sem novas transições nem edição', async () => {
      const pedido = await adicionarItem(await novoPedido(), {});
      await mudarStatus(pedido, 'CONFIRMADO').expect(200);
      const concluido = dadosDe<Pedido>(await mudarStatus(pedido, 'CONCLUIDO').expect(200));

      const cancelar = await mudarStatus(pedido, 'CANCELADO');
      const editar = await api.patch(`/pedidos/${pedido.id}`, { descontoCentavos: 100 });
      const item = await api.post(`/pedidos/${pedido.id}/itens`, {
        produtoId: cenario.coxinha.id,
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        quantidade: 1,
      });

      expect(concluido.transicoesPermitidas).toEqual([]);
      expect([cancelar.status, editar.status, item.status]).toEqual([422, 422, 422]);
      expect(erroDe(editar).code).toBe('PEDIDO_ENCERRADO');
    });

    it('exige estornar os pagamentos antes de cancelar (D4)', async () => {
      const pedido = await adicionarItem(await novoPedido(), {});
      await mudarStatus(pedido, 'CONFIRMADO').expect(200);
      const comPagamento = dadosDe<Pedido>(await pagar(pedido, 'PIX', 5000).expect(201));

      const recusado = await mudarStatus(pedido, 'CANCELADO');
      await api
        .delete(`/pedidos/${pedido.id}/pagamentos/${comPagamento.pagamentos[0]?.id ?? ''}`)
        .expect(200);
      const cancelado = await mudarStatus(pedido, 'CANCELADO');

      expect(recusado.status).toBe(422);
      expect(erroDe(recusado).code).toBe('PEDIDO_COM_PAGAMENTOS');
      expect(cancelado.status).toBe(200);
    });

    it('conclui pedido de entrega sem exigir mais nada', async () => {
      const pedido = await adicionarItem(await novoPedido({ tipoEntrega: 'ENTREGA' }), {});
      await mudarStatus(pedido, 'CONFIRMADO').expect(200);

      const concluido = await mudarStatus(pedido, 'CONCLUIDO');

      expect(concluido.status).toBe(200);
    });

    it('confirma rascunho só com desconto até o valor dos itens', async () => {
      const pedido = await adicionarItem(await novoPedido({ descontoCentavos: 20000 }), {});

      const recusado = await mudarStatus(pedido, 'CONFIRMADO');

      expect(recusado.status).toBe(422);
      expect(erroDe(recusado)).toMatchObject({
        code: 'DESCONTO_MAIOR_QUE_SUBTOTAL',
        message: 'O desconto não pode passar do valor dos itens (R$ 95,00).',
      });
    });
  });

  describe('pagamentos', () => {
    it('deriva o estado de pagamento de dinheiro e PIX, sem contar o fiado (D1)', async () => {
      const pedido = await adicionarItem(await novoPedido(), { quantidade: 2 });

      const parcial = dadosDe<Pedido>(await pagar(pedido, 'DINHEIRO', 5000).expect(201));
      const comFiado = dadosDe<Pedido>(await pagar(pedido, 'FIADO', 14000).expect(201));
      const pago = dadosDe<Pedido>(await pagar(pedido, 'PIX', 14000).expect(201));

      expect([parcial.statusPagamento, comFiado.statusPagamento, pago.statusPagamento]).toEqual([
        'PARCIAL',
        'PARCIAL',
        'PAGO',
      ]);
      expect(comFiado.resumo).toMatchObject({
        totalPagoCentavos: 5000,
        totalFiadoCentavos: 14000,
        saldoDevedorCentavos: 14000,
      });
    });

    it('recusa valor acima do saldo e fiado acima do saldo ainda não marcado', async () => {
      const pedido = await adicionarItem(await novoPedido(), {});

      const acima = await pagar(pedido, 'PIX', 9501);
      await pagar(pedido, 'FIADO', 9000).expect(201);
      const fiadoAcima = await pagar(pedido, 'FIADO', 501);

      expect(acima.status).toBe(422);
      expect(erroDe(acima)).toMatchObject({
        code: 'PAGAMENTO_ACIMA_DO_SALDO',
        message: 'O valor passa do saldo em aberto (R$ 95,00).',
      });
      expect(erroDe(fiadoAcima).message).toBe('O valor passa do saldo em aberto (R$ 5,00).');
    });

    it('estorna logicamente: o lançamento fica no histórico e sai das somas', async () => {
      const pedido = dadosDe<Pedido>(
        await pagar(await adicionarItem(await novoPedido(), {}), 'PIX', 9500).expect(201),
      );
      const pagamentoId = pedido.pagamentos[0]?.id ?? '';

      const estornado = dadosDe<Pedido>(
        await api.delete(`/pedidos/${pedido.id}/pagamentos/${pagamentoId}`).expect(200),
      );
      const denovo = await api.delete(`/pedidos/${pedido.id}/pagamentos/${pagamentoId}`);

      expect(estornado.statusPagamento).toBe('PENDENTE');
      expect(estornado.pagamentos).toHaveLength(1);
      expect(estornado.pagamentos[0]?.estornadoEm).not.toBeNull();
      expect(erroDe(denovo).code).toBe('PAGAMENTO_ESTORNADO');
    });

    it('impede reduzir o total abaixo do que já foi pago', async () => {
      const pedido = await adicionarItem(await novoPedido(), { quantidade: 2 });
      await pagar(pedido, 'DINHEIRO', 19000).expect(201);
      const item = pedido.itens[0];

      const menos = await api.patch(`/pedidos/${pedido.id}/itens/${item?.id ?? ''}`, {
        quantidade: 1,
      });
      const desconto = await api.patch(`/pedidos/${pedido.id}`, { descontoCentavos: 100 });

      expect([menos.status, desconto.status]).toEqual([422, 422]);
      expect(erroDe(menos)).toMatchObject({
        code: 'TOTAL_MENOR_QUE_PAGO',
        message:
          'O total ficaria abaixo do que já foi pago (R$ 190,00). Estorne um pagamento antes.',
      });
      const atual = dadosDe<Pedido>(await api.get(`/pedidos/${pedido.id}`));
      expect(atual.itens[0]?.quantidade).toBe(2);
    });
  });

  it('não deixa um pedido confirmado sem itens', async () => {
    const pedido = await adicionarItem(await novoPedido(), {});
    await mudarStatus(pedido, 'CONFIRMADO').expect(200);

    const resposta = await api.delete(`/pedidos/${pedido.id}/itens/${pedido.itens[0]?.id ?? ''}`);

    expect(resposta.status).toBe(422);
    expect(erroDe(resposta).code).toBe('PEDIDO_SEM_ITENS');
  });

  it('troca entre entrega e retirada sem mudar valores', async () => {
    const pedido = await adicionarItem(await novoPedido({ tipoEntrega: 'ENTREGA' }), {});

    const retirada = dadosDe<Pedido>(
      await api.patch(`/pedidos/${pedido.id}`, { tipoEntrega: 'RETIRADA' }).expect(200),
    );

    expect(retirada.tipoEntrega).toBe('RETIRADA');
    expect(retirada.resumo.totalCentavos).toBe(pedido.resumo.totalCentavos);
  });

  it('recusa null em campos que não podem ser apagados', async () => {
    const pedido = await novoPedido();

    const resposta = await api.patch(`/pedidos/${pedido.id}`, {
      dataEntrega: null,
      descontoCentavos: null,
    });

    expect(resposta.status).toBe(400);
  });

  describe('listagem', () => {
    it('filtra por status e data, busca por número ou cliente, com totais', async () => {
      const outro = dadosDe<{ id: string }>(
        await api.post('/clientes', { nome: 'Célia Menezes' }).expect(201),
      );
      const hoje = await adicionarItem(await novoPedido({ horarioEntrega: '15:00' }), {
        quantidade: 2,
      });
      await mudarStatus(hoje, 'CONFIRMADO').expect(200);
      await novoPedido({ horarioEntrega: '10:00' });
      const amanha = await novoPedido({ dataEntrega: '2026-10-03', clienteId: outro.id });

      const doDia = await api.get('/pedidos?de=2026-10-02&ate=2026-10-02').expect(200);
      const confirmados = await api.get('/pedidos?status=CONFIRMADO').expect(200);
      const porCliente = await api.get(`/pedidos?busca=${encodeURIComponent('celia')}`).expect(200);
      const porNumero = await api
        .get(`/pedidos?busca=${encodeURIComponent(`#${String(amanha.numero)}`)}`)
        .expect(200);

      const lista = dadosDe<
        {
          horarioEntrega: string;
          status: string;
          totalCentavos: number;
          quantidadeItens: number;
        }[]
      >(doDia);
      expect(lista.map((p) => p.horarioEntrega)).toEqual(['10:00', '15:00']);
      expect(lista[1]).toMatchObject({
        status: 'CONFIRMADO',
        totalCentavos: 19000,
        quantidadeItens: 1,
      });
      expect(metaDe(confirmados)?.total).toBe(1);
      expect(dadosDe<{ id: string }[]>(porCliente).map((p) => p.id)).toEqual([amanha.id]);
      expect(dadosDe<{ id: string }[]>(porNumero).map((p) => p.id)).toEqual([amanha.id]);
    });

    it('ordena os anteriores do mais recente para o mais antigo', async () => {
      await novoPedido({ dataEntrega: '2026-09-28' });
      await novoPedido({ dataEntrega: '2026-09-30' });

      const resposta = await api.get('/pedidos?ate=2026-10-01&ordem=desc').expect(200);

      expect(dadosDe<{ dataEntrega: string }[]>(resposta).map((p) => p.dataEntrega)).toEqual([
        '2026-09-30',
        '2026-09-28',
      ]);
    });

    it('recusa status desconhecido', async () => {
      const resposta = await api.get('/pedidos?status=ENTREGUE');
      expect(resposta.status).toBe(400);
    });
  });
});
