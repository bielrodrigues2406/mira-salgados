import { centavosDeTexto, centavosParaTexto, formatarMoeda } from './dinheiro';

describe('centavosDeTexto', () => {
  it.each([
    ['95', 9500],
    ['95,00', 9500],
    ['95,5', 9550],
    ['1,20', 120],
    ['1.20', 120],
    ['0,05', 5],
    ['1.234,56', 123456],
    ['1.200', 120000],
    ['R$ 110,00', 11000],
  ])('lê "%s" como %i centavos', (texto, esperado) => {
    expect(centavosDeTexto(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1,234', '9,5,0', '-5', '1.2.3', '12.345.6'])('recusa "%s"', (texto) => {
    expect(centavosDeTexto(texto)).toBeNull();
  });
});

describe('formatação', () => {
  it('formata em reais com separadores brasileiros', () => {
    expect(formatarMoeda(9500).replace(/\s/g, ' ')).toBe('R$ 95,00');
    expect(formatarMoeda(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
    expect(formatarMoeda(120).replace(/\s/g, ' ')).toBe('R$ 1,20');
  });

  it('prepara o valor para edição', () => {
    expect(centavosParaTexto(9500)).toBe('95,00');
    expect(centavosParaTexto(5)).toBe('0,05');
  });
});
