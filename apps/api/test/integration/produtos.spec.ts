import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LogAuditoria } from '../../src/auditoria/log-auditoria.entity.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe, metaDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

interface Preco {
  id: string;
  preparo: string;
  unidadeVenda: string;
  precoCentavos: number;
  vigenteDesde: string;
  vigenteAte: string | null;
}

interface Produto {
  id: string;
  nome: string;
  ativo: boolean;
  produtorPadrao: { id: string; nome: string; ativo: boolean };
  precosVigentes: Preco[];
}

interface Produtor {
  id: string;
  nome: string;
  produtosPadrao: { id: string; nome: string }[];
}

describe('produtos e preços', () => {
  let app: NestExpressApplication;
  let api: ClienteHttp;
  let mira: Produtor;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await limparBanco(app);
    api = await clienteAutenticado(app);
    mira = await novoProdutor('Mira');
  });

  afterAll(async () => {
    await app.close();
  });

  async function novoProdutor(nome: string): Promise<Produtor> {
    return dadosDe<Produtor>(await api.post('/produtores', { nome }).expect(201));
  }

  async function novoProduto(nome: string, produtorPadraoId = mira.id): Promise<Produto> {
    return dadosDe<Produto>(await api.post('/produtos', { nome, produtorPadraoId }).expect(201));
  }

  async function definirPreco(
    produto: Produto,
    preparo: string,
    unidadeVenda: string,
    precoCentavos: number,
  ): Promise<Produto> {
    const resposta = await api
      .post(`/produtos/${produto.id}/precos`, { preparo, unidadeVenda, precoCentavos })
      .expect(201);
    return dadosDe<Produto>(resposta);
  }

  function combinacoes(produto: Produto): string[] {
    return produto.precosVigentes.map(
      (preco) => `${preco.preparo}-${preco.unidadeVenda}-${String(preco.precoCentavos)}`,
    );
  }

  it('exige autenticação', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/produtos');
    expect(resposta.status).toBe(401);
  });

  it('cadastra com produtor padrão e sem preços', async () => {
    const produto = await novoProduto('Coxinha de frango');

    expect(produto).toMatchObject({
      nome: 'Coxinha de frango',
      ativo: true,
      produtorPadrao: { id: mira.id, nome: 'Mira', ativo: true },
      precosVigentes: [],
    });
  });

  it('exige produtor padrão existente e ativo', async () => {
    const nair = await novoProdutor('Nair');
    await api.patch(`/produtores/${nair.id}`, { ativo: false }).expect(200);

    const inativo = await api.post('/produtos', { nome: 'Kibe', produtorPadraoId: nair.id });
    const inexistente = await api.post('/produtos', {
      nome: 'Kibe',
      produtorPadraoId: crypto.randomUUID(),
    });

    expect([inativo.status, inexistente.status]).toEqual([422, 422]);
    expect(erroDe(inativo)).toMatchObject({
      code: 'PRODUTOR_INVALIDO',
      message: 'Escolha um produtor ativo como padrão.',
    });
  });

  it('recusa nome repetido sem distinção de maiúsculas', async () => {
    await novoProduto('Kibe');

    const resposta = await api.post('/produtos', { nome: 'KIBE', produtorPadraoId: mira.id });

    expect(resposta.status).toBe(409);
    expect(erroDe(resposta).code).toBe('PRODUTO_JA_EXISTE');
  });

  it('valida o novo preço: inteiro em centavos, positivo e combinação conhecida', async () => {
    const produto = await novoProduto('Kibe');
    const caminho = `/produtos/${produto.id}/precos`;

    const zero = await api.post(caminho, {
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 0,
    });
    const fracionado = await api.post(caminho, {
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 95.5,
    });
    const preparo = await api.post(caminho, {
      preparo: 'COZIDO',
      unidadeVenda: 'CENTO',
      precoCentavos: 9500,
    });

    expect([zero.status, fracionado.status, preparo.status]).toEqual([400, 400, 400]);
    expect(erroDe(preparo).details).toEqual([
      {
        field: 'preparo',
        messages: ['O campo "preparo" deve ser um destes valores: FRITO, ASSADO, CONGELADO.'],
      },
    ]);
  });

  it('lista os preços vigentes na ordem do cardápio, sem perder centavos', async () => {
    let produto = await novoProduto('Coxinha de frango');
    await definirPreco(produto, 'CONGELADO', 'CENTO', 8000);
    await definirPreco(produto, 'FRITO', 'UNIDADE', 120);
    produto = await definirPreco(produto, 'FRITO', 'CENTO', 9500);

    expect(combinacoes(produto)).toEqual([
      'FRITO-CENTO-9500',
      'FRITO-UNIDADE-120',
      'CONGELADO-CENTO-8000',
    ]);
  });

  it('substitui o preço vigente e mantém o anterior no histórico, sem lacuna', async () => {
    const produto = await novoProduto('Kibe');
    await definirPreco(produto, 'FRITO', 'CENTO', 9000);
    const atualizado = await definirPreco(produto, 'FRITO', 'CENTO', 9500);

    const historico = await api.get(`/produtos/${produto.id}/precos`).expect(200);
    const [novo, antigo] = dadosDe<Preco[]>(historico);

    expect(combinacoes(atualizado)).toEqual(['FRITO-CENTO-9500']);
    expect(metaDe(historico)?.total).toBe(2);
    expect(novo).toMatchObject({ precoCentavos: 9500, vigenteAte: null });
    expect(antigo).toMatchObject({ precoCentavos: 9000, vigenteAte: novo?.vigenteDesde });
  });

  it('recusa definir o mesmo preço que já vale', async () => {
    const produto = await novoProduto('Kibe');
    await definirPreco(produto, 'FRITO', 'CENTO', 9000);

    const resposta = await api.post(`/produtos/${produto.id}/precos`, {
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 9000,
    });

    expect(resposta.status).toBe(422);
    expect(erroDe(resposta)).toMatchObject({
      code: 'PRECO_INALTERADO',
      message: 'Este já é o preço vigente de Frito · Cento.',
    });
  });

  it('mantém um único preço vigente com alterações simultâneas da mesma combinação', async () => {
    const produto = await novoProduto('Esfiha de carne');

    const respostas = await Promise.all(
      [11000, 11100, 11200, 11300, 11400].map((precoCentavos) =>
        api.post(`/produtos/${produto.id}/precos`, {
          preparo: 'ASSADO',
          unidadeVenda: 'CENTO',
          precoCentavos,
        }),
      ),
    );

    expect(respostas.map((resposta) => resposta.status)).toEqual([201, 201, 201, 201, 201]);
    const atual = dadosDe<Produto>(await api.get(`/produtos/${produto.id}`).expect(200));
    const historico = dadosDe<Preco[]>(await api.get(`/produtos/${produto.id}/precos`).expect(200));
    expect(atual.precosVigentes).toHaveLength(1);
    expect(historico).toHaveLength(5);
    expect(historico.filter((preco) => preco.vigenteAte === null)).toHaveLength(1);
  });

  it('encerra um preço, que sai da tabela e fica no histórico', async () => {
    let produto = await novoProduto('Kibe');
    produto = await definirPreco(produto, 'CONGELADO', 'CENTO', 7500);
    const preco = produto.precosVigentes[0];
    if (!preco) throw new Error('Preço não criado');

    const encerrado = await api.delete(`/produtos/${produto.id}/precos/${preco.id}`).expect(200);
    const denovo = await api.delete(`/produtos/${produto.id}/precos/${preco.id}`);
    const outroProduto = await novoProduto('Risole');
    const deOutro = await api.delete(`/produtos/${outroProduto.id}/precos/${preco.id}`);

    expect(dadosDe<Produto>(encerrado).precosVigentes).toEqual([]);
    expect(denovo.status).toBe(422);
    expect(erroDe(denovo).code).toBe('PRECO_ENCERRADO');
    expect(deOutro.status).toBe(404);
    const historico = dadosDe<Preco[]>(await api.get(`/produtos/${produto.id}/precos`));
    expect(historico[0]?.vigenteAte).not.toBeNull();
  });

  it('não altera preços de produto inativo', async () => {
    const produto = await novoProduto('Kibe');
    const desativado = await api.delete(`/produtos/${produto.id}`).expect(200);
    expect(dadosDe<Produto>(desativado).ativo).toBe(false);

    const resposta = await api.post(`/produtos/${produto.id}/precos`, {
      preparo: 'FRITO',
      unidadeVenda: 'CENTO',
      precoCentavos: 9000,
    });

    expect(resposta.status).toBe(422);
    expect(erroDe(resposta).code).toBe('PRODUTO_INATIVO');
  });

  it('troca o produtor padrão e lista os produtos de cada produtor', async () => {
    const celia = await novoProdutor('Célia');
    const kibe = await novoProduto('Kibe');
    await novoProduto('Coxinha de frango');
    await novoProduto('Bolinha de queijo');

    await api.patch(`/produtos/${kibe.id}`, { produtorPadraoId: celia.id }).expect(200);

    const produtores = dadosDe<Produtor[]>(await api.get('/produtores').expect(200));
    expect(
      produtores.map((p) => [p.nome, p.produtosPadrao.map((produto) => produto.nome)]),
    ).toEqual([
      ['Célia', ['Kibe']],
      ['Mira', ['Bolinha de queijo', 'Coxinha de frango']],
    ]);
  });

  it('impede desativar o produtor padrão de produtos ativos', async () => {
    const coxinha = await novoProduto('Coxinha de frango');
    await novoProduto('Kibe');

    const bloqueado = await api.patch(`/produtores/${mira.id}`, { ativo: false });
    expect(bloqueado.status).toBe(422);
    expect(erroDe(bloqueado)).toMatchObject({
      code: 'PRODUTOR_PADRAO_EM_USO',
      message: 'Mira é o produtor padrão de 2 produtos ativos. Troque o padrão antes de desativar.',
    });

    const kibe = dadosDe<Produto[]>(await api.get('/produtos')).find((p) => p.nome === 'Kibe');
    await api.patch(`/produtos/${coxinha.id}`, { ativo: false }).expect(200);
    await api.patch(`/produtos/${kibe?.id ?? ''}`, { ativo: false }).expect(200);
    await api.patch(`/produtores/${mira.id}`, { ativo: false }).expect(200);
  });

  it('audita a troca de preço como encerramento do antigo e criação do novo', async () => {
    const produto = await novoProduto('Kibe');
    await definirPreco(produto, 'FRITO', 'CENTO', 9000);
    await definirPreco(produto, 'FRITO', 'CENTO', 9500);

    // Encerramento e criação são da mesma transação e podem ter o mesmo horário.
    const logs = await app
      .get(DataSource)
      .getRepository(LogAuditoria)
      .findBy({ entidade: 'preco_produto' });
    const resumo = logs
      .map((log) => `${log.acao}:${JSON.stringify(log.dadosDepois?.['preco'])}`)
      .sort();

    expect(resumo).toEqual(['CRIACAO:9000', 'CRIACAO:9500', 'DESATIVACAO:9000']);
    expect(logs.every((log) => log.usuarioId === api.usuarioId)).toBe(true);
  });
});
