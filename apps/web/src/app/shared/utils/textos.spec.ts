import {
  composicao,
  contagem,
  listaDePedidos,
  numero,
  percentuaisInteiros,
  percentual,
  percentualDeDecimos,
  rotuloDaVenda,
} from './textos';

describe('textos de quantidades', () => {
  it('separa milhares como no Brasil', () => {
    expect(numero(1570)).toBe('1.570');
    expect(contagem(1, 'encomenda', 'encomendas')).toBe('1 encomenda');
    expect(contagem(1200, 'salgado', 'salgados')).toBe('1.200 salgados');
  });

  it('descreve como o item foi vendido', () => {
    expect(rotuloDaVenda('CENTO', 1)).toBe('1 cento');
    expect(rotuloDaVenda('CENTO', 3)).toBe('3 centos');
    expect(rotuloDaVenda('UNIDADE', 20)).toBe('Avulsas');
    expect(rotuloDaVenda('UNIDADE', 1)).toBe('Avulsa');
  });

  it('compõe centos e avulsas', () => {
    expect(composicao(5, 0)).toBe('5 centos');
    expect(composicao(1, 50)).toBe('1 cento + 50 avulsas');
    expect(composicao(0, 20)).toBe('20 avulsas');
    expect(composicao(0, 1)).toBe('1 avulsa');
  });

  it('lista os pedidos com vírgula e "e"', () => {
    expect(listaDePedidos([1042])).toBe('pedido #1042');
    expect(listaDePedidos([1042, 1043])).toBe('pedidos #1042 e #1043');
    expect(listaDePedidos([1, 2, 3])).toBe('pedidos #1, #2 e #3');
    expect(listaDePedidos([])).toBe('');
  });

  it('mostra participação em décimos com vírgula', () => {
    expect(percentualDeDecimos(568)).toBe('56,8%');
    expect(percentualDeDecimos(1000)).toBe('100,0%');
    expect(percentualDeDecimos(5)).toBe('0,5%');
  });

  it('escreve percentuais com vírgula', () => {
    expect(percentual(54.5)).toBe('54,5%');
    expect(percentual(100)).toBe('100%');
  });

  it('arredonda percentuais de barra para somar 100', () => {
    expect(percentuaisInteiros([62200, 39000, 40500])).toEqual([44, 27, 29]);
    expect(percentuaisInteiros([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentuaisInteiros([0, 0])).toEqual([0, 0]);
  });
});
