import { Writable } from 'node:stream';

import { type Logger, pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { buildRedactPaths, stripQueryString } from './logger.config.js';

function capturarLog(registrar: (logger: Logger) => void): Record<string, unknown> {
  let linha = '';
  const destino = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      linha += chunk.toString();
      callback();
    },
  });
  const logger = pino({ redact: { paths: buildRedactPaths(), censor: '[REDACTED]' } }, destino);
  registrar(logger);
  return JSON.parse(linha) as Record<string, unknown>;
}

describe('buildRedactPaths', () => {
  it('oculta campos sensíveis na raiz e em objetos aninhados', () => {
    const registro = capturarLog((logger) => {
      logger.info(
        {
          senha: 'segredo-1',
          dto: { email: 'ana@exemplo.com', senha: 'segredo-2' },
          contexto: { sessao: { refreshToken: 'segredo-3' } },
        },
        'teste',
      );
    });
    const texto = JSON.stringify(registro);

    expect(texto).not.toMatch(/segredo-\d/);
    expect(texto).toContain('[REDACTED]');
    expect(texto).toContain('ana@exemplo.com');
  });
});

describe('stripQueryString', () => {
  it('remove a query string do caminho registrado', () => {
    expect(stripQueryString('/api/v1/clientes?busca=Ana%20Paula')).toBe('/api/v1/clientes');
    expect(stripQueryString('/api/v1/health')).toBe('/api/v1/health');
    expect(stripQueryString(undefined)).toBe('');
  });
});
