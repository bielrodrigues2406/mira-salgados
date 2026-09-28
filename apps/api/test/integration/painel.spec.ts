import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type Cenario, montarCenario, type Ref } from './helpers/cenario.js';
import { limparBanco } from './helpers/database.js';
import { type ClienteHttp, clienteAutenticado, dadosDe, erroDe } from './helpers/http.js';
import { createTestApp } from './helpers/test-app.js';

// Quinta-feira: a semana vai de 28/09 a 04/10 e atravessa a virada do mês.
const DIA = '2026-10-01';

type NovoItem = [produto: Ref, unidadeVenda: 'CENTO' | 'UNIDADE', quantidade: number];

interface ProducaoPorDia {
  unidades: number;
  dias: {
    data: string;
    quantidadePedidos: number;
    unidades: number;
    produtores: {
      produtor: Ref;
      unidades: number;
      salgados: { produto: Ref; preparo: string; unidades: number }[];
    }[];
  }[];
}

interface Ganho {
  de: string;
  ate: string;
  unidades: number;
  produzidoCentavos: number;
  recebidoCentavos: number;
}

interface Painel {
  data: string;
  produtor: Ref | null;
  hoje: {
    quantidadePedidos: number;
    unidades: number;
    aEntregar: { numero: number; horario: string | null; cliente: Ref; unidades: number }[];
    semPagamento: { valorCentavos: number; pedidos: number[] };
  };
  proximosDias: {
    data: string;
    unidades: number;
    minhasUnidades: number | null;
    meusSalgados: { produto: Ref; unidades: number }[] | null;
  }[];
  ganhos: { semana: Ganho; mes: Ganho } | null;
  familia: {
    semana: {
      de: string;
      ate: string;
      unidades: number;
      faturamentoCentavos: number;
      caixaCentavos: number;
    };
    fiados: { totalEmAbertoCentavos: number; quantidadePedidos: number };
    rascunhos: number;
  };
}

describe('painel e produção por dia', () => {
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
    membro = await clienteAutenticado(app);
    cenario = await montarCenario(admin);
  });

  afterAll(async () => {
    await app.close();
  });

  async function pedido(opcoes: {
    dataEntrega: string;
    horarioEntrega?: string;
    itens: NovoItem[];
    confirmar?: boolean;
    pagamentos?: ['PIX' | 'DINHEIRO' | 'FIADO', number][];
  }): Promise<{ id: string; numero: number }> {
    const criado = dadosDe<{ id: string; numero: number }>(
      await admin
        .post('/pedidos', {
          clienteId: cenario.ana.id,
          tipoEntrega: 'RETIRADA',
          dataEntrega: opcoes.dataEntrega,
          ...(opcoes.horarioEntrega ? { horarioEntrega: opcoes.horarioEntrega } : {}),
        })
        .expect(201),
    );
    for (const [produto, unidadeVenda, quantidade] of opcoes.itens) {
      await admin
        .post(`/pedidos/${criado.id}/itens`, {
          produtoId: produto.id,
          preparo: 'FRITO',
          unidadeVenda,
          quantidade,
        })
        .expect(201);
    }
    if (opcoes.confirmar ?? true) {
      await admin.patch(`/pedidos/${criado.id}/status`, { status: 'CONFIRMADO' }).expect(200);
    }
    for (const [forma, valorCentavos] of opcoes.pagamentos ?? []) {
      await admin.post(`/pedidos/${criado.id}/pagamentos`, { forma, valorCentavos }).expect(201);
    }
    return criado;
  }

  async function semanaDeExemplo(): Promise<{ hoje: number }> {
    const hoje = await pedido({
      dataEntrega: DIA,
      horarioEntrega: '10:00',
      itens: [[cenario.coxinha, 'CENTO', 2]],
      pagamentos: [['PIX', 19000]],
    });
    await pedido({
      dataEntrega: '2026-10-02',
      itens: [
        [cenario.kibe, 'CENTO', 1],
        [cenario.coxinha, 'CENTO', 1],
      ],
    });
    await pedido({
      dataEntrega: '2026-10-03',
      itens: [[cenario.kibe, 'CENTO', 3]],
      confirmar: false,
    });
    await pedido({
      dataEntrega: '2026-09-29',
      itens: [[cenario.coxinha, 'CENTO', 1]],
      pagamentos: [['DINHEIRO', 9500]],
    });
    return { hoje: hoje.numero };
  }

  async function ligar(conta: ClienteHttp, produtor: Ref | null): Promise<void> {
    await admin
      .patch(`/usuarios/${conta.usuarioId}`, { produtorId: produtor?.id ?? null })
      .expect(200);
  }

  describe('GET /relatorios/producao-por-dia', () => {
    it('exige autenticação e limita o intervalo a um mês', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/relatorios/producao-por-dia?de=${DIA}&ate=2026-10-07`)
        .expect(401);
      const longo = await membro.get('/relatorios/producao-por-dia?de=2026-10-01&ate=2026-11-01');
      expect(longo.status).toBe(400);
      expect(erroDe(longo).code).toBe('VALIDATION_FAILED');
    });

    it('mostra cada dia, com a carga de cada produtor por salgado, sem rascunhos', async () => {
      await semanaDeExemplo();

      const producao = dadosDe<ProducaoPorDia>(
        await membro.get(`/relatorios/producao-por-dia?de=${DIA}&ate=2026-10-03`).expect(200),
      );

      expect(producao.unidades).toBe(400);
      expect(producao.dias.map((dia) => [dia.data, dia.unidades])).toEqual([
        ['2026-10-01', 200],
        ['2026-10-02', 200],
        ['2026-10-03', 0],
      ]);
      expect(
        producao.dias[1]?.produtores.map((carga) => [carga.produtor.nome, carga.unidades]),
      ).toEqual([
        ['Célia', 100],
        ['Mira', 100],
      ]);
      expect(producao.dias[1]?.produtores[0]?.salgados).toEqual([
        { produto: { id: cenario.kibe.id, nome: 'Kibe' }, preparo: 'FRITO', unidades: 100 },
      ]);
    });

    it('filtra por produtor', async () => {
      await semanaDeExemplo();

      const producao = dadosDe<ProducaoPorDia>(
        await membro
          .get(
            `/relatorios/producao-por-dia?de=${DIA}&ate=2026-10-02&produtorId=${cenario.celia.id}`,
          )
          .expect(200),
      );

      expect(producao.dias.map((dia) => dia.unidades)).toEqual([0, 100]);
    });
  });

  describe('GET /painel', () => {
    it('para quem produz: a própria produção dos próximos dias e os ganhos por dia de acerto', async () => {
      const { hoje } = await semanaDeExemplo();
      await ligar(membro, cenario.mira);

      const painel = dadosDe<Painel>(await membro.get(`/painel?data=${DIA}`).expect(200));

      expect(painel.produtor).toEqual({ id: cenario.mira.id, nome: 'Mira' });
      expect(painel.hoje).toMatchObject({
        quantidadePedidos: 1,
        unidades: 200,
        aEntregar: [{ numero: hoje, horario: '10:00', unidades: 200 }],
        semPagamento: { valorCentavos: 0, pedidos: [] },
      });
      expect(painel.proximosDias).toHaveLength(7);
      expect(
        painel.proximosDias.slice(0, 3).map((dia) => [dia.unidades, dia.minhasUnidades]),
      ).toEqual([
        [200, 200],
        [200, 100],
        [0, 0],
      ]);
      expect(painel.proximosDias[1]?.meusSalgados).toEqual([
        {
          produto: { id: cenario.coxinha.id, nome: 'Coxinha de frango' },
          preparo: 'FRITO',
          unidades: 100,
        },
      ]);
      expect(painel.ganhos).toEqual({
        semana: {
          de: '2026-09-28',
          ate: '2026-10-04',
          unidades: 400,
          produzidoCentavos: 38000,
          recebidoCentavos: 28500,
        },
        mes: {
          de: '2026-10-01',
          ate: '2026-10-31',
          unidades: 300,
          produzidoCentavos: 28500,
          recebidoCentavos: 19000,
        },
      });
      expect(painel.familia).toEqual({
        semana: {
          de: '2026-09-28',
          ate: '2026-10-04',
          unidades: 500,
          faturamentoCentavos: 47000,
          caixaCentavos: 28500,
        },
        fiados: { totalEmAbertoCentavos: 0, quantidadePedidos: 0 },
        rascunhos: 1,
      });
    });

    it('para quem não produz: sem produção própria nem ganhos', async () => {
      await semanaDeExemplo();

      const painel = dadosDe<Painel>(await membro.get(`/painel?data=${DIA}`).expect(200));

      expect(painel.produtor).toBeNull();
      expect(painel.ganhos).toBeNull();
      expect(painel.proximosDias[0]).toMatchObject({
        unidades: 200,
        minhasUnidades: null,
        meusSalgados: null,
      });
    });

    it('exige autenticação e data válida', async () => {
      await request(app.getHttpServer()).get(`/api/v1/painel?data=${DIA}`).expect(401);
      expect((await membro.get('/painel')).status).toBe(400);
    });
  });

  describe('conta ligada a produtor', () => {
    it('aparece na resposta e pode ser desfeita', async () => {
      await ligar(membro, cenario.celia);
      const lista = dadosDe<{ id: string; produtorId: string | null }[]>(
        await admin.get('/usuarios').expect(200),
      );
      expect(lista.find((conta) => conta.id === membro.usuarioId)?.produtorId).toBe(
        cenario.celia.id,
      );

      await ligar(membro, null);
      const depois = dadosDe<{ id: string; produtorId: string | null }[]>(
        await admin.get('/usuarios').expect(200),
      );
      expect(depois.find((conta) => conta.id === membro.usuarioId)?.produtorId).toBeNull();
    });

    it('um produtor tem no máximo uma conta', async () => {
      await ligar(membro, cenario.celia);

      const outra = await admin.patch(`/usuarios/${admin.usuarioId}`, {
        produtorId: cenario.celia.id,
      });

      expect(outra.status).toBe(409);
      expect(erroDe(outra).code).toBe('PRODUTOR_JA_VINCULADO');
    });

    it('recusa produtor inexistente ou inativo', async () => {
      // Célia é produtora padrão do kibe e não pode ser desativada: usa uma produtora avulsa.
      const rosa = dadosDe<Ref>(await admin.post('/produtores', { nome: 'Rosa' }).expect(201));
      await admin.patch(`/produtores/${rosa.id}`, { ativo: false }).expect(200);

      const inativo = await admin.patch(`/usuarios/${membro.usuarioId}`, { produtorId: rosa.id });
      const inexistente = await admin.patch(`/usuarios/${membro.usuarioId}`, {
        produtorId: '00000000-0000-4000-8000-000000000000',
      });

      expect(inativo.status).toBe(422);
      expect(erroDe(inativo).code).toBe('PRODUTOR_INDISPONIVEL');
      expect(inexistente.status).toBe(422);
    });

    it('membro não liga a própria conta: só administrador gerencia contas', async () => {
      const resposta = await membro.patch(`/usuarios/${membro.usuarioId}`, {
        produtorId: cenario.celia.id,
      });
      expect(resposta.status).toBe(403);
    });
  });
});
