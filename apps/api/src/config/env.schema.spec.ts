import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema.js';

const ambienteValido = {
  DATABASE_URL: 'postgres://mira:segredo@localhost:5432/mira_salgados',
  CORS_ORIGINS: 'http://localhost:4200',
};

describe('validateEnv', () => {
  it('aplica valores padrão às variáveis opcionais', () => {
    const env = validateEnv(ambienteValido);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY).toBe(0);
  });

  it('converte a lista de origens separada por vírgula', () => {
    const env = validateEnv({
      ...ambienteValido,
      CORS_ORIGINS: 'https://mira.exemplo.com, http://localhost:4200',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://mira.exemplo.com', 'http://localhost:4200']);
  });

  it('falha quando DATABASE_URL está ausente', () => {
    expect(() => validateEnv({ CORS_ORIGINS: 'http://localhost:4200' })).toThrow(/DATABASE_URL/);
  });

  it('rejeita curinga na lista de origens', () => {
    expect(() => validateEnv({ ...ambienteValido, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
  });

  it('rejeita URL de banco que não seja PostgreSQL', () => {
    expect(() =>
      validateEnv({ ...ambienteValido, DATABASE_URL: 'mysql://root@localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('não expõe valores recebidos na mensagem de erro', () => {
    const segredo = 'mysql://usuario:senha-super-secreta@host/db';

    let mensagem = '';
    try {
      validateEnv({ ...ambienteValido, DATABASE_URL: segredo });
    } catch (erro) {
      mensagem = (erro as Error).message;
    }

    expect(mensagem).toContain('DATABASE_URL');
    expect(mensagem).not.toContain('senha-super-secreta');
  });
});
