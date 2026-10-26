import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { lerCatalogo } from './catalogo.js';

const valido = {
  produtores: ['Mira', 'Gabriel'],
  produtos: [
    { nome: 'Kibe', produtor: 'gabriel', precos: { FRITO: { CENTO: 11000 } } },
    {
      nome: ' Esfiha de carne ',
      produtor: 'Mira',
      precos: { ASSADO: { CENTO: 11000 }, CONGELADO: { CENTO: 11000 } },
    },
  ],
};

function erroDe(bruto: unknown): string {
  try {
    lerCatalogo(bruto);
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
  throw new Error('O catálogo deveria ter sido recusado.');
}

describe('lerCatalogo', () => {
  it('aceita o catálogo, apara os nomes e casa o produtor sem diferenciar maiúsculas', () => {
    const catalogo = lerCatalogo(valido);

    expect(catalogo.produtores).toEqual(['Mira', 'Gabriel']);
    expect(catalogo.produtos[1]).toEqual({
      nome: 'Esfiha de carne',
      produtor: 'Mira',
      precos: { ASSADO: { CENTO: 11000 }, CONGELADO: { CENTO: 11000 } },
    });
  });

  it('recusa o que não é objeto e listas vazias', () => {
    expect(erroDe(null)).toContain('precisa ser um objeto');
    expect(erroDe([])).toContain('precisa ser um objeto');
    const mensagem = erroDe({ produtores: [], produtos: [] });
    expect(mensagem).toContain('lista de produtores');
    expect(mensagem).toContain('lista de produtos');
  });

  it('junta todos os problemas numa mensagem só', () => {
    const mensagem = erroDe({
      produtores: ['Mira', 'mira', ''],
      produtos: [
        { nome: 'Kibe', produtor: 'Rafael', precos: { FRITO: { CENTO: 11000 } } },
        { nome: 'kibe', produtor: 'Mira', precos: { FRITO: { CENTO: 11000 } } },
        { nome: 'Coxinha', produtor: 'Mira', precos: { COZIDO: { CENTO: 1 } } },
        { nome: 'Empada', produtor: 'Mira', precos: { ASSADO: { DUZIA: 1 } } },
        { nome: 'Pastel', produtor: 'Mira', precos: { FRITO: { CENTO: 110.5 } } },
        { nome: 'Risoles', produtor: 'Mira', precos: { FRITO: { CENTO: 0 } } },
        { nome: 'X'.repeat(81), produtor: 'Mira', precos: { FRITO: { CENTO: 1 } } },
        'texto solto',
      ],
    });

    expect(mensagem).toContain('Produtor "mira" aparece duas vezes');
    expect(mensagem).toContain('Produtor 3: informe o nome');
    expect(mensagem).toContain('o produtor "Rafael" não está na lista');
    expect(mensagem).toContain('Produto "kibe" aparece duas vezes');
    expect(mensagem).toContain('preparo desconhecido "COZIDO"');
    expect(mensagem).toContain('unidade desconhecida "DUZIA"');
    expect(mensagem).toContain('Produto "Pastel", FRITO CENTO: o preço precisa ser um inteiro');
    expect(mensagem).toContain('Produto "Risoles", FRITO CENTO: o preço precisa ser um inteiro');
    expect(mensagem).toContain('Produto 7: o nome passa de 80 caracteres');
    expect(mensagem).toContain('Produto 8: informe nome, produtor e preços');
  });

  it('exige ao menos um preço por produto', () => {
    const semPrecos = { produtores: ['Mira'], produtos: [{ nome: 'Kibe', produtor: 'Mira' }] };
    const precosVazios = {
      produtores: ['Mira'],
      produtos: [{ nome: 'Kibe', produtor: 'Mira', precos: { FRITO: {} } }],
    };

    expect(erroDe(semPrecos)).toContain('Produto "Kibe": informe os preços');
    expect(erroDe(precosVazios)).toContain('Produto "Kibe": informe ao menos um preço');
  });

  it('aceita o catálogo que vai para o servidor', () => {
    const arquivo = new URL(
      '../../../../deploy/mira-salgados/catalogo-inicial.json',
      import.meta.url,
    );
    const catalogo = lerCatalogo(JSON.parse(readFileSync(arquivo, 'utf8')) as unknown);

    expect(catalogo.produtores).toEqual(['Mira', 'Gabriel', 'Mariellen e Elton']);
    expect(catalogo.produtos).toHaveLength(12);
    // Congelado com R$ 10,00 de desconto no cento, exceto os assados.
    for (const produto of catalogo.produtos) {
      const congelado = produto.precos.CONGELADO?.CENTO;
      const assado = produto.precos.ASSADO?.CENTO;
      const frito = produto.precos.FRITO?.CENTO;
      if (assado === undefined) expect(congelado).toBe((frito ?? 0) - 1000);
      else expect(congelado).toBe(assado);
    }
  });
});
