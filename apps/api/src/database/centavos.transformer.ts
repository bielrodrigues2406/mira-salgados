import type { ValueTransformer } from 'typeorm';

import {
  type Centavos,
  centavosParaDecimal,
  decimalParaCentavos,
} from '../common/utils/dinheiro.js';

// Colunas `numeric(10,2)` chegam do driver como texto ("95.00") e são
// convertidas em centavos sem passar por ponto flutuante. Valores que não são
// número (operadores de consulta do TypeORM, por exemplo) seguem intactos.
export const centavosTransformer = {
  to(value: unknown): unknown {
    return typeof value === 'number' ? centavosParaDecimal(value as Centavos) : value;
  },
  from(value: unknown): Centavos | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
      throw new TypeError('Coluna monetária deveria chegar do banco como texto.');
    }
    return decimalParaCentavos(value);
  },
} satisfies ValueTransformer;
