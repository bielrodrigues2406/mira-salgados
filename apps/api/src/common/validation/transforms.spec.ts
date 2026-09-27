import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { Aparar, ApararOuNulo, BooleanoDeQuery, SomenteDigitos } from './transforms.js';

class Exemplo {
  @Aparar()
  nome?: unknown;

  @BooleanoDeQuery()
  ativo?: unknown;

  @ApararOuNulo()
  endereco?: unknown;

  @SomenteDigitos()
  telefone?: unknown;
}

describe('Aparar', () => {
  it('remove espaços nas pontas de textos', () => {
    expect(plainToInstance(Exemplo, { nome: '  Célia  ' }).nome).toBe('Célia');
  });

  it('mantém valores que não são texto', () => {
    expect(plainToInstance(Exemplo, { nome: 42 }).nome).toBe(42);
  });

  it('normaliza acentos combinantes para a forma composta', () => {
    const nome = plainToInstance(Exemplo, { nome: 'Ce\u0301lia' }).nome;
    expect(nome).toBe('C\u00e9lia');
  });
});

describe('ApararOuNulo', () => {
  it('apara e transforma texto vazio em null', () => {
    expect(plainToInstance(Exemplo, { endereco: '  Rua Tupi, 88 ' }).endereco).toBe('Rua Tupi, 88');
    expect(plainToInstance(Exemplo, { endereco: '   ' }).endereco).toBeNull();
    expect(plainToInstance(Exemplo, { endereco: null }).endereco).toBeNull();
  });
});

describe('SomenteDigitos', () => {
  it('remove a máscara e transforma ausência de dígitos em null', () => {
    expect(plainToInstance(Exemplo, { telefone: '(11) 99134-2280' }).telefone).toBe('11991342280');
    expect(plainToInstance(Exemplo, { telefone: ' - ' }).telefone).toBeNull();
    expect(plainToInstance(Exemplo, { telefone: 11991342280 }).telefone).toBe(11991342280);
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
