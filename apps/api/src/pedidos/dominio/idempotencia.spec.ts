import { describe, expect, it } from 'vitest';

import { BusinessRuleError } from '../../common/errors/domain.errors.js';
import {
  hashCanonicaRequisicao,
  normalizarChaveIdempotencia,
  serializarCanonico,
} from './idempotencia.js';

describe('idempotência de criação de pedidos', () => {
  it('aceita chave ausente ou válida e apara espaços nas pontas', () => {
    expect(normalizarChaveIdempotencia(undefined)).toBeUndefined();
    expect(normalizarChaveIdempotencia('  abc-123_XYZ  ')).toBe('abc-123_XYZ');
  });

  it('recusa chave vazia, longa demais ou com espaços internos', () => {
    expect(() => normalizarChaveIdempotencia('   ')).toThrow(BusinessRuleError);
    expect(() => normalizarChaveIdempotencia('a'.repeat(129))).toThrow(BusinessRuleError);
    expect(() => normalizarChaveIdempotencia('chave com espaco')).toThrow(BusinessRuleError);
  });

  it('gera o mesmo hash independente da ordem das propriedades e distingue ordem dos itens', () => {
    const a = hashCanonicaRequisicao({
      clienteId: 'c1',
      descontoCentavos: 0,
      itens: [
        { produtoId: 'p1', quantidade: 0.5 },
        { produtoId: 'p2', quantidade: 1 },
      ],
    });
    const b = hashCanonicaRequisicao({
      itens: [
        { quantidade: 0.5, produtoId: 'p1' },
        { quantidade: 1, produtoId: 'p2' },
      ],
      descontoCentavos: 0,
      clienteId: 'c1',
      observacao: undefined,
    });
    const invertido = hashCanonicaRequisicao({
      clienteId: 'c1',
      descontoCentavos: 0,
      itens: [
        { produtoId: 'p2', quantidade: 1 },
        { produtoId: 'p1', quantidade: 0.5 },
      ],
    });

    expect(a).toBe(b);
    expect(a).not.toBe(invertido);
    expect(serializarCanonico({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});
