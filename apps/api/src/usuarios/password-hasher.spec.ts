import argon2 from 'argon2';
import { beforeAll, describe, expect, it } from 'vitest';

import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  beforeAll(async () => {
    await hasher.onModuleInit();
  });

  it('gera hash Argon2id que confere com a senha original', async () => {
    const hash = await hasher.hash('uma senha longa o bastante');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(hash, 'uma senha longa o bastante')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'outra senha qualquer')).resolves.toBe(false);
  });

  it('recusa quando não há hash, sem lançar erro', async () => {
    await expect(hasher.verify(undefined, 'qualquer')).resolves.toBe(false);
  });

  it('pede novo hash quando os parâmetros ficaram mais fracos que os atuais', async () => {
    const antigo = await argon2.hash('senha', {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 2,
    });
    const atual = await hasher.hash('senha');

    expect(hasher.needsRehash(antigo)).toBe(true);
    expect(hasher.needsRehash(atual)).toBe(false);
  });
});
