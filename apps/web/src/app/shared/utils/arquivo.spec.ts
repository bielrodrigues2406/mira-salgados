import { csv, reaisNoCsv } from './arquivo';

describe('arquivo', () => {
  it('gera CSV com ponto e vírgula, BOM e aspas quando preciso', () => {
    const arquivo = csv(
      'fiados',
      ['Cliente', 'Valor'],
      [
        ['Ana; Paula', '10,50'],
        ['Buffet "Sabor"', null],
      ],
    );

    expect(arquivo.nome).toBe('fiados.csv');
    expect(arquivo.tipo).toBe('text/csv;charset=utf-8');
    expect(arquivo.conteudo).toBe(
      '﻿Cliente;Valor\r\n"Ana; Paula";10,50\r\n"Buffet ""Sabor""";\r\n',
    );
  });

  it('neutraliza textos que a planilha leria como fórmula', () => {
    const { conteudo } = csv('x', ['Obs'], [['=HYPERLINK("http://x")'], ['-2'], [-2]]);

    expect(conteudo.split('\r\n').slice(1, 4)).toEqual([
      `"'=HYPERLINK(""http://x"")"`,
      "'-2",
      '-2',
    ]);
  });

  it('escreve reais com vírgula decimal', () => {
    expect(reaisNoCsv(123456)).toBe('1234,56');
    expect(reaisNoCsv(5)).toBe('0,05');
    expect(reaisNoCsv(-1500)).toBe('-15,00');
  });
});
