import { DESTINOS, INFERIORES, iniciais, MAIS } from './destinos';

describe('destinos', () => {
  it('começa a navegação principal pelo Início', () => {
    expect(DESTINOS.map((destino) => destino.rotulo)).toEqual([
      'Início',
      'Pedidos',
      'Produção',
      'Clientes',
      'Produtos',
      'Relatórios',
      'Repasses',
    ]);
  });

  it('no celular, deixa na barra o uso diário e o resto em Mais', () => {
    expect(INFERIORES.map((destino) => destino.rotulo)).toEqual(['Início', 'Pedidos', 'Produção']);
    expect(MAIS.map((destino) => destino.rotulo)).toEqual([
      'Clientes',
      'Produtos',
      'Relatórios',
      'Repasses',
      'Produtores',
    ]);
  });

  it.each([
    ['Lúcia Andrade', 'LA'],
    ['Mira', 'MI'],
    ['Célia', 'CÉ'],
    ['Ce\u0301lia', 'CE\u0301'],
    ['  ana paula ribeiro ', 'AR'],
    ['', ''],
  ])('extrai as iniciais de "%s"', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });
});
