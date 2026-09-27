import { describe, expect, it } from 'vitest';

import { centavos } from '../common/utils/dinheiro.js';
import { centavosTransformer } from './centavos.transformer.js';

describe('centavosTransformer', () => {
  it('grava centavos como decimal com duas casas', () => {
    expect(centavosTransformer.to(centavos(9500))).toBe('95.00');
    expect(centavosTransformer.to(centavos(140))).toBe('1.40');
  });

  it('lê o texto do banco como centavos exatos', () => {
    expect(centavosTransformer.from('95.00')).toBe(9500);
    expect(centavosTransformer.from('0.10')).toBe(10);
    expect(centavosTransformer.from(null)).toBeNull();
  });

  it('não altera valores que não são números', () => {
    const operador = { type: 'moreThan' };
    expect(centavosTransformer.to(operador)).toBe(operador);
  });

  it('falha se o driver entregar número em vez de texto', () => {
    expect(() => {
      centavosTransformer.from(95.5);
    }).toThrow(TypeError);
  });
});
