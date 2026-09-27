import { describe, expect, it } from 'vitest';

import { escaparLike } from './like.js';

describe('escaparLike', () => {
  it('escapa curingas e a própria barra', () => {
    expect(escaparLike('100%_certo\\')).toBe('100\\%\\_certo\\\\');
  });

  it('mantém texto comum', () => {
    expect(escaparLike('Célia')).toBe('Célia');
  });
});
