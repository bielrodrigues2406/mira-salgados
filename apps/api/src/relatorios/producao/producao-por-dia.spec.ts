import { describe, expect, it } from 'vitest';

import { type ItemDoIntervalo, montarProducaoPorDia } from './producao-por-dia.js';

const CELIA = { id: 'p1', nome: 'Célia' };
const MIRA = { id: 'p2', nome: 'Mira' };
const COXINHA = { id: 'c', nome: 'Coxinha' };
const KIBE = { id: 'k', nome: 'Kibe' };

function item(parcial: Partial<ItemDoIntervalo>): ItemDoIntervalo {
  return {
    data: '2026-09-29',
    pedidoId: 'a',
    produto: COXINHA,
    produtor: CELIA,
    preparo: 'FRITO',
    unidadeVenda: 'CENTO',
    quantidade: 1,
    ...parcial,
  };
}

describe('montarProducaoPorDia', () => {
  it('lista todos os dias do intervalo, inclusive os vazios', () => {
    const producao = montarProducaoPorDia('2026-09-28', '2026-09-30', [item({})]);

    expect(producao.dias.map((dia) => [dia.data, dia.unidades])).toEqual([
      ['2026-09-28', 0],
      ['2026-09-29', 100],
      ['2026-09-30', 0],
    ]);
    expect(producao.unidades).toBe(100);
  });

  it('soma por produtor e salgado, juntando centos e avulsas de pedidos diferentes', () => {
    const producao = montarProducaoPorDia('2026-09-29', '2026-09-29', [
      item({ pedidoId: 'a', quantidade: 2 }),
      item({ pedidoId: 'b', unidadeVenda: 'UNIDADE', quantidade: 30 }),
      item({ pedidoId: 'b', produto: KIBE, quantidade: 1 }),
      item({ pedidoId: 'c', produtor: MIRA, quantidade: 5 }),
      item({ pedidoId: 'c', produto: COXINHA, preparo: 'CONGELADO', quantidade: 1 }),
    ]);

    const [dia] = producao.dias;
    expect(dia?.quantidadePedidos).toBe(3);
    expect(dia?.unidades).toBe(1030);
    expect(dia?.produtores).toEqual([
      {
        produtor: CELIA,
        unidades: 530,
        salgados: [
          { produto: COXINHA, preparo: 'FRITO', unidades: 230 },
          { produto: COXINHA, preparo: 'CONGELADO', unidades: 100 },
          { produto: KIBE, preparo: 'FRITO', unidades: 100 },
        ],
      },
      {
        produtor: MIRA,
        unidades: 500,
        salgados: [{ produto: COXINHA, preparo: 'FRITO', unidades: 500 }],
      },
    ]);
  });
});
