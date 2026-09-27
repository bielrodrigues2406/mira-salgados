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
});
