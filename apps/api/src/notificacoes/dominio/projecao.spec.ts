import { describe, expect, it } from 'vitest';

import { hashProjecaoPedido, projetarPedido } from './projecao.js';

describe('projeção e hash notificável de pedido', () => {
  const pedidoBase = {
    id: 'ped-1',
    numero: 1043,
    status: 'CONFIRMADO' as const,
    dataEntrega: '2026-10-02',
    horarioEntrega: '18:30:00',
    tipoEntrega: 'ENTREGA' as const,
  };

  it('soma unidades de linhas repetidas do mesmo produto e preparo e ordena assados primeiro', () => {
    const projecao = projetarPedido(pedidoBase, [
      {
        produtoId: 'p-coxinha',
        produtoNome: 'Coxinha de frango',
        preparo: 'FRITO',
        unidadeVenda: 'CENTO',
        quantidade: 0.5,
      },
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'CENTO',
        quantidade: 0.5,
      },
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'UNIDADE',
        quantidade: 50,
      },
    ]);

    expect(projecao.horarioEntrega).toBe('18:30');
    expect(projecao.itens).toEqual([
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidades: 100,
      },
      {
        produtoId: 'p-coxinha',
        produtoNome: 'Coxinha de frango',
        preparo: 'FRITO',
        unidades: 50,
      },
    ]);
  });

  it('gera o mesmo hash para linhas fragmentadas que somam as mesmas unidades e muda quando entrega/horário/itens mudam', () => {
    const a = projetarPedido(pedidoBase, [
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'CENTO',
        quantidade: 1,
      },
    ]);
    const b = projetarPedido(pedidoBase, [
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'CENTO',
        quantidade: 0.5,
      },
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'UNIDADE',
        quantidade: 50,
      },
    ]);
    const horarioDiferente = projetarPedido({ ...pedidoBase, horarioEntrega: '19:00:00' }, [
      {
        produtoId: 'p-esfiha',
        produtoNome: 'Esfiha de carne',
        preparo: 'ASSADO',
        unidadeVenda: 'CENTO',
        quantidade: 1,
      },
    ]);

    expect(hashProjecaoPedido(a)).toHaveLength(64);
    expect(hashProjecaoPedido(a)).toBe(hashProjecaoPedido(b));
    expect(hashProjecaoPedido(a)).not.toBe(hashProjecaoPedido(horarioDiferente));
  });
});
