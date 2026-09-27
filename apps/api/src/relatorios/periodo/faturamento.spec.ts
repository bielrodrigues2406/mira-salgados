import { describe, expect, it } from 'vitest';

import { centavos } from '../../common/utils/dinheiro.js';
import { type DiaDeFaturamento, resumirFaturamento } from './faturamento.js';

function dia(
  data: string,
  pedidos: number,
  faturamento: number,
  recebido: number,
  fiado = 0,
): DiaDeFaturamento {
  return {
    data,
    quantidadePedidos: pedidos,
    unidades: pedidos * 100,
    faturamento: centavos(faturamento),
    descontos: centavos(0),
    recebido: centavos(recebido),
    fiado: centavos(fiado),
  };
}

describe('faturamento do período', () => {
  it('soma os dias e separa o recebido do que falta receber', () => {
    const resumo = resumirFaturamento([
      dia('2026-10-01', 2, 40000, 30000),
      dia('2026-10-02', 4, 141700, 62200, 39000),
    ]);

    expect(resumo).toMatchObject({
      quantidadePedidos: 6,
      unidades: 600,
      faturamento: 181700,
      recebido: 92200,
      fiado: 39000,
      aReceber: 89500,
    });
    expect(resumo.porDia.map((d) => d.data)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('arredonda o ticket médio ao centavo', () => {
    expect(resumirFaturamento([dia('2026-10-01', 3, 10000, 0)]).ticketMedio).toBe(3333);
    expect(resumirFaturamento([dia('2026-10-01', 3, 10001, 0)]).ticketMedio).toBe(3334);
  });

  it('período sem pedidos tem ticket médio zero', () => {
    expect(resumirFaturamento([])).toMatchObject({
      quantidadePedidos: 0,
      faturamento: 0,
      ticketMedio: 0,
    });
  });
});
