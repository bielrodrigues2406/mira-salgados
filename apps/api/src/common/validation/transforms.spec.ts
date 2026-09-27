import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { Aparar, BooleanoDeQuery } from './transforms.js';

class Exemplo {
  @Aparar()
  nome?: unknown;

  @BooleanoDeQuery()
  ativo?: unknown;
}

describe('Aparar', () => {
  it('remove espaços nas pontas de textos', () => {
    expect(plainToInstance(Exemplo, { nome: '  Célia  ' }).nome).toBe('Célia');
  });

  it('mantém valores que não são texto', () => {
    expect(plainToInstance(Exemplo, { nome: 42 }).nome).toBe(42);
  });
});

describe('BooleanoDeQuery', () => {
  it('converte apenas "true" e "false"', () => {
    expect(plainToInstance(Exemplo, { ativo: 'true' }).ativo).toBe(true);
    expect(plainToInstance(Exemplo, { ativo: 'false' }).ativo).toBe(false);
  });

  it('deixa outros valores para a validação recusar', () => {
    expect(plainToInstance(Exemplo, { ativo: '1' }).ativo).toBe('1');
    expect(plainToInstance(Exemplo, { ativo: 'sim' }).ativo).toBe('sim');
  });
});
