import { describe, expect, it } from 'vitest';

import {
  centavos,
  centavosParaDecimal,
  formatarReais,
  decimalParaCentavos,
  multiplicar,
  ratearCentavos,
  ratearInteiro,
  somar,
  subtrair,
} from './dinheiro.js';

describe('decimalParaCentavos', () => {
  it.each([
    ['95.00', 9500],
    ['95', 9500],
    ['1.4', 140],
    ['1.40', 140],
    ['0.01', 1],
    ['-20.00', -2000],
    [' 12.34 ', 1234],
  ])('converte "%s" em %i centavos', (texto, esperado) => {
    expect(decimalParaCentavos(texto)).toBe(esperado);
  });

  it('não sofre o erro clássico de ponto flutuante', () => {
    // 0.1 + 0.2 em float resulta em 0.30000000000000004.
    expect(somar(decimalParaCentavos('0.1'), decimalParaCentavos('0.2'))).toBe(30);
  });

  it.each(['', 'abc', '1.234', '1,50', '1e3', '--1', '12345678901234.00'])(
    'rejeita "%s"',
    (texto) => {
      expect(() => decimalParaCentavos(texto)).toThrow(RangeError);
    },
  );
});

describe('centavosParaDecimal', () => {
  it.each([
    [9500, '95.00'],
    [140, '1.40'],
    [5, '0.05'],
    [0, '0.00'],
    [-2000, '-20.00'],
    [-5, '-0.05'],
  ])('formata %i como "%s"', (valor, esperado) => {
    expect(centavosParaDecimal(centavos(valor))).toBe(esperado);
  });
});

describe('operações', () => {
  it('soma, subtrai e multiplica em inteiros', () => {
    const subtotal = somar(multiplicar(centavos(9500), 3), centavos(9000));
    expect(subtotal).toBe(37_500);
    expect(subtrair(subtotal, centavos(2000))).toBe(35_500);
  });

  it('calcula frações de cento e arredonda por item', () => {
    expect(multiplicar(centavos(9500), 0.5)).toBe(4750);
    expect(multiplicar(centavos(9500), 1.2)).toBe(11400);
    expect(multiplicar(centavos(9500), 1.5)).toBe(14250);
    expect(multiplicar(centavos(9501), 0.5)).toBe(4751);
    expect(multiplicar(centavos(9500), 0.29)).toBe(2755);
  });

  it('recusa frações menores que um salgado por cento', () => {
    expect(() => multiplicar(centavos(100), 1.005)).toThrow(RangeError);
  });

  it('recusa valores fora do intervalo seguro', () => {
    expect(() => centavos(0.5)).toThrow(RangeError);
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('ratearInteiro', () => {
  it('distribui proporcionalmente e fecha com o total', () => {
    const partes = ratearInteiro(62_200, [80_500, 42_000, 19_200]);

    expect(partes).toEqual([35_336, 18_436, 8_428]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(62_200);
  });

  it('entrega as sobras às maiores frações', () => {
    // 100 dividido em três partes iguais: 33,33 cada; a unidade que sobra vai
    // para a primeira, pelo critério de desempate estável.
    expect(ratearInteiro(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('calcula percentuais em décimos que somam 100,0%', () => {
    expect(ratearInteiro(1000, [80_500, 42_000, 19_200])).toEqual([568, 296, 136]);
  });

  it('mantém a soma exata com valores que estourariam a aritmética de ponto flutuante', () => {
    const total = 9_999_999_999_99;
    const pesos = [3_333_333_333_33, 3_333_333_333_33, 3_333_333_333_33];
    const partes = ratearInteiro(total, pesos);

    expect(partes.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('devolve zeros quando não há nada a ratear', () => {
    expect(ratearInteiro(0, [0, 0])).toEqual([0, 0]);
    expect(ratearInteiro(0, [])).toEqual([]);
  });

  it('recusa total positivo sem pesos positivos', () => {
    expect(() => ratearInteiro(100, [0, 0])).toThrow(RangeError);
  });

  it('recusa pesos negativos ou fracionários', () => {
    expect(() => ratearInteiro(100, [-1, 2])).toThrow(RangeError);
    expect(() => ratearInteiro(100, [1.5, 2])).toThrow(RangeError);
  });

  it('é exposto com o tipo Centavos', () => {
    const partes = ratearCentavos(centavos(1000), [centavos(1), centavos(3)]);
    expect(partes).toEqual([250, 750]);
  });
});

describe('formatarReais', () => {
  it('formata centavos em reais com separadores brasileiros', () => {
    expect(formatarReais(centavos(123456))).toBe('R$ 1.234,56');
    expect(formatarReais(centavos(5))).toBe('R$ 0,05');
    expect(formatarReais(centavos(100000000))).toBe('R$ 1.000.000,00');
    expect(formatarReais(centavos(-2000))).toBe('-R$ 20,00');
  });
});
