import { IsEnum, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { createValidationPipe, ValidationFailedException } from './validation.js';

enum Preparo {
  FRITO = 'FRITO',
  ASSADO = 'ASSADO',
}

class ItemDto {
  @IsInt()
  @Min(1)
  quantidade: number;
}

class ExemploDto {
  @IsString()
  @MaxLength(5)
  nome: string;

  @IsInt()
  @Max(10)
  limite: number;

  @IsEnum(Preparo)
  preparo: Preparo;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  itens: ItemDto[];
}

async function validar(corpo: unknown): Promise<ValidationFailedException> {
  const pipe = createValidationPipe();
  try {
    await pipe.transform(corpo, { type: 'body', metatype: ExemploDto });
  } catch (erro) {
    if (erro instanceof ValidationFailedException) return erro;
    throw erro;
  }
  throw new Error('A validação deveria ter falhado.');
}

const corpoValido = { nome: 'Kibe', limite: 3, preparo: 'FRITO', itens: [{ quantidade: 2 }] };

describe('createValidationPipe', () => {
  it('aceita um corpo válido e devolve a instância do DTO', async () => {
    const pipe = createValidationPipe();
    const resultado: unknown = await pipe.transform(corpoValido, {
      type: 'body',
      metatype: ExemploDto,
    });

    expect(resultado).toBeInstanceOf(ExemploDto);
  });

  it('rejeita propriedades não declaradas em vez de descartá-las', async () => {
    const erro = await validar({ ...corpoValido, ativo: false });

    expect(erro.fieldErrors).toEqual([
      { field: 'ativo', messages: ['O campo "ativo" não é permitido.'] },
    ]);
  });

  it('rejeita propriedades não declaradas em objetos aninhados', async () => {
    const erro = await validar({ ...corpoValido, itens: [{ quantidade: 1, precoUnitario: 1 }] });

    expect(erro.fieldErrors).toEqual([
      { field: 'itens.0.precoUnitario', messages: ['O campo "precoUnitario" não é permitido.'] },
    ]);
  });

  it('traduz as mensagens e preserva os limites das regras', async () => {
    const erro = await validar({ nome: 'Coxinha', limite: 11, preparo: 'CRU', itens: [] });
    const porCampo = Object.fromEntries(erro.fieldErrors.map((f) => [f.field, f.messages]));

    expect(porCampo['nome']).toEqual(['O campo "nome" deve ter no máximo 5 caracteres.']);
    expect(porCampo['limite']).toEqual(['O campo "limite" deve ser no máximo 10.']);
    expect(porCampo['preparo']).toEqual([
      'O campo "preparo" deve ser um destes valores: FRITO, ASSADO.',
    ]);
  });

  it('não converte tipos implicitamente', async () => {
    const erro = await validar({ ...corpoValido, limite: '3' });

    expect(erro.fieldErrors[0]?.field).toBe('limite');
  });
});
