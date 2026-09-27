import { DESTINOS, iniciais } from './destinos';

describe('destinos', () => {
  it('tem os cinco destinos da navegação principal, na ordem do design', () => {
    expect(DESTINOS.map((destino) => destino.rotulo)).toEqual([
      'Pedidos',
      'Produção',
      'Clientes',
      'Produtos',
      'Relatórios',
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
