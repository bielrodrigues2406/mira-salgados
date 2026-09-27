import { describe, expect, it } from 'vitest';

import { Paginated } from '../pagination/pagination.js';
import { wrapInEnvelope } from './response-envelope.interceptor.js';

describe('wrapInEnvelope', () => {
  it('envolve o corpo em data', () => {
    expect(wrapInEnvelope({ id: '1' })).toEqual({ data: { id: '1' } });
    expect(wrapInEnvelope([1, 2])).toEqual({ data: [1, 2] });
  });

  it('mantém respostas sem corpo', () => {
    expect(wrapInEnvelope(undefined)).toBeUndefined();
  });

  it('separa itens e metadados de paginação', () => {
    const pagina = new Paginated(['a', 'b'], 45, 2, 20);

    expect(wrapInEnvelope(pagina)).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, pageSize: 20, total: 45, totalPages: 3 },
    });
  });

  it('leva o resumo da coleção inteira ao lado da paginação, mesmo depois de map', () => {
    const pagina = new Paginated([1, 2], 2, 1, 20, { totalEmAbertoCentavos: 900 });

    expect(wrapInEnvelope(pagina.map(String))).toEqual({
      data: ['1', '2'],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      resumo: { totalEmAbertoCentavos: 900 },
    });
  });
});
