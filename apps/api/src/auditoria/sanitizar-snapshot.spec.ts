import { describe, expect, it } from 'vitest';

import { sanitizarSnapshot } from './sanitizar-snapshot.js';

describe('sanitizarSnapshot', () => {
  it('remove hash de senha e tokens, inclusive aninhados', () => {
    const snapshot = sanitizarSnapshot({
      id: 'u1',
      nome: 'Lúcia',
      senhaHash: '$argon2id$...',
      sessao: { tokenHash: 'abc', refreshToken: 'def', criadaEm: 'x' },
    });

    expect(snapshot).toEqual({ id: 'u1', nome: 'Lúcia', sessao: { criadaEm: 'x' } });
  });

  it('serializa datas em ISO', () => {
    const snapshot = sanitizarSnapshot({ criadoEm: new Date('2026-10-02T12:00:00Z') });

    expect(snapshot).toEqual({ criadoEm: '2026-10-02T12:00:00.000Z' });
  });

  it('preserva a ausência de estado', () => {
    expect(sanitizarSnapshot(null)).toBeNull();
    expect(sanitizarSnapshot(undefined)).toBeNull();
  });
});
