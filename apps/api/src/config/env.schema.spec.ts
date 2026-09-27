import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema.js';

const ambienteValido = {
  DATABASE_URL: 'postgres://mira:segredo@localhost:5432/mira_salgados',
  CORS_ORIGINS: 'http://localhost:4200',
  JWT_ACCESS_SECRET: 'x'.repeat(48),
};

function mensagemDeErro(raw: Record<string, unknown>): string {
  try {
    validateEnv(raw);
  } catch (erro) {
    return (erro as Error).message;
  }
  throw new Error('A validação deveria ter falhado.');
}

describe('validateEnv', () => {
  it('aplica valores padrão às variáveis opcionais', () => {
    const env = validateEnv(ambienteValido);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      TRUST_PROXY: 0,
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 14,
      COOKIE_SECURE: true,
    });
  });

  it('converte a lista de origens separada por vírgula', () => {
    const env = validateEnv({
      ...ambienteValido,
      CORS_ORIGINS: 'https://mira.exemplo.com, http://localhost:4200',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://mira.exemplo.com', 'http://localhost:4200']);
  });

  it('interpreta booleanos escritos como texto', () => {
    const env = validateEnv({ ...ambienteValido, COOKIE_SECURE: 'false' });

    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('falha quando DATABASE_URL está ausente', () => {
    const { DATABASE_URL: _removida, ...semBanco } = ambienteValido;

    expect(mensagemDeErro(semBanco)).toContain('DATABASE_URL');
  });

  it('falha sem segredo de assinatura, sem valor padrão embutido', () => {
    const { JWT_ACCESS_SECRET: _removido, ...semSegredo } = ambienteValido;

    expect(mensagemDeErro(semSegredo)).toContain('JWT_ACCESS_SECRET');
  });

  it('rejeita segredo curto demais para HS256', () => {
    expect(mensagemDeErro({ ...ambienteValido, JWT_ACCESS_SECRET: 'curto' })).toContain(
      'JWT_ACCESS_SECRET',
    );
  });

  it('limita a vida do access token a no máximo uma hora', () => {
    expect(mensagemDeErro({ ...ambienteValido, JWT_ACCESS_TTL_SECONDS: '7200' })).toContain(
      'JWT_ACCESS_TTL_SECONDS',
    );
  });

  it('exige cookie Secure em produção', () => {
    expect(
      mensagemDeErro({ ...ambienteValido, NODE_ENV: 'production', COOKIE_SECURE: 'false' }),
    ).toContain('COOKIE_SECURE');
  });

  it('rejeita curinga na lista de origens', () => {
    expect(mensagemDeErro({ ...ambienteValido, CORS_ORIGINS: '*' })).toContain('CORS_ORIGINS');
  });

  it('rejeita URL de banco que não seja PostgreSQL', () => {
    expect(
      mensagemDeErro({ ...ambienteValido, DATABASE_URL: 'mysql://root@localhost/db' }),
    ).toContain('DATABASE_URL');
  });

  it('não expõe valores recebidos na mensagem de erro', () => {
    const mensagem = mensagemDeErro({
      ...ambienteValido,
      DATABASE_URL: 'mysql://usuario:senha-super-secreta@host/db',
      JWT_ACCESS_SECRET: 'segredo-curto',
    });

    expect(mensagem).not.toContain('senha-super-secreta');
    expect(mensagem).not.toContain('segredo-curto');
  });
});
