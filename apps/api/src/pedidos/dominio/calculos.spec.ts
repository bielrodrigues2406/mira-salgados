import { describe, expect, it } from 'vitest';

import { type Centavos, centavos } from '../../common/utils/dinheiro.js';
import { resumoFinanceiro, statusDoPagamento, subtotalItem } from './calculos.js';

const c = (valor: number): Centavos => centavos(valor);

// Pedido #1043 do protótipo: 3 centos de coxinha a R$ 95,00, kibe, esfiha e
// risole a um cento cada, com desconto de R$ 20,00.
const ITENS = [
  { quantidade: 3, precoUnitario: c(9500) },
  { quantidade: 1, precoUnitario: c(9000) },
  { quantidade: 1, precoUnitario: c(11000) },
  { quantidade: 1, precoUnitario: c(7500) },
];

describe('cálculos do pedido', () => {
  it('multiplica quantidade pelo preço unitário em centavos', () => {
    expect(subtotalItem({ quantidade: 3, precoUnitario: c(9500) })).toBe(28500);
    expect(subtotalItem({ quantidade: 250, precoUnitario: c(120) })).toBe(30000);
  });

  it('aplica o desconto ao subtotal', () => {
    const resumo = resumoFinanceiro(ITENS, c(2000), [
      { forma: 'PIX', valor: c(20000) },
      { forma: 'DINHEIRO', valor: c(10000) },
    ]);

    expect(resumo).toEqual({
      subtotal: 56000,
      desconto: 2000,
      total: 54000,
      totalPago: 30000,
      totalFiado: 0,
      saldoDevedor: 24000,
      statusPagamento: 'PARCIAL',
    });
  });

  it('não soma nada por ser entrega: o total é o valor dos itens menos o desconto', () => {
    const resumo = resumoFinanceiro([{ quantidade: 2, precoUnitario: c(9500) }], c(0), []);

    expect(resumo.total).toBe(19000);
    expect(resumo.statusPagamento).toBe('PENDENTE');
  });

  it('não soma o fiado ao pago nem o abate do saldo (D1)', () => {
    const resumo = resumoFinanceiro(ITENS, c(0), [{ forma: 'FIADO', valor: c(56000) }]);

    expect(resumo.totalPago).toBe(0);
    expect(resumo.totalFiado).toBe(56000);
    expect(resumo.saldoDevedor).toBe(56000);
    expect(resumo.statusPagamento).toBe('PENDENTE');
  });

  it('quita com dinheiro e PIX mesmo havendo fiado registrado', () => {
    const resumo = resumoFinanceiro([{ quantidade: 1, precoUnitario: c(9000) }], c(0), [
      { forma: 'FIADO', valor: c(9000) },
      { forma: 'DINHEIRO', valor: c(9000) },
    ]);

    expect(resumo.statusPagamento).toBe('PAGO');
    expect(resumo.saldoDevedor).toBe(0);
  });

  it('não produz saldo negativo quando o pago supera o total', () => {
    const resumo = resumoFinanceiro([{ quantidade: 1, precoUnitario: c(9000) }], c(1000), [
      { forma: 'PIX', valor: c(9000) },
    ]);

    expect(resumo.saldoDevedor).toBe(0);
    expect(resumo.statusPagamento).toBe('PAGO');
  });

  it('pedido sem itens tem total zero e segue pendente', () => {
    const resumo = resumoFinanceiro([], c(0), []);

    expect(resumo.total).toBe(0);
    expect(resumo.statusPagamento).toBe('PENDENTE');
  });

  it('desconto integral sobre itens quita o pedido', () => {
    expect(
      resumoFinanceiro([{ quantidade: 1, precoUnitario: c(9000) }], c(9000), []).statusPagamento,
    ).toBe('PAGO');
  });

  it.each([
    [c(54000), c(0), 'PENDENTE'],
    [c(54000), c(1), 'PARCIAL'],
    [c(54000), c(53999), 'PARCIAL'],
    [c(54000), c(54000), 'PAGO'],
    [c(0), c(0), 'PAGO'],
  ])('total %i com pago %i fica %s', (total, pago, esperado) => {
    expect(statusDoPagamento(total, pago)).toBe(esperado);
  });
});
