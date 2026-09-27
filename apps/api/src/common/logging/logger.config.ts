import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';

import type { Env } from '../../config/env.schema.js';

// Campos que nunca podem aparecer em log, em qualquer nível de aninhamento
// coberto pela lista de caminhos gerada abaixo.
export const SENSITIVE_FIELDS = [
  'senha',
  'senhaAtual',
  'novaSenha',
  'senhaHash',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
] as const;

const MAX_DEPTH = 3;

export function buildRedactPaths(): string[] {
  const paths: string[] = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
  ];
  for (const field of SENSITIVE_FIELDS) {
    for (let depth = 0; depth <= MAX_DEPTH; depth++) {
      paths.push([...Array<string>(depth).fill('*'), field].join('.'));
    }
  }
  return paths;
}

// A query string pode carregar dado pessoal (busca por nome de cliente); o log
// registra apenas o caminho.
export function stripQueryString(url: string | undefined): string {
  return (url ?? '').split('?', 1)[0] ?? '';
}

function levelFor(res: ServerResponse, error: Error | undefined): 'error' | 'warn' | 'info' {
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

export function loggerParams(level: Env['LOG_LEVEL']): Params {
  return {
    pinoHttp: {
      level,
      genReqId: (_req: IncomingMessage, res: ServerResponse) => {
        // O identificador é sempre gerado no servidor; aceitar o do cliente
        // permitiria injetar valores arbitrários nos logs.
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      redact: { paths: buildRedactPaths(), censor: '[REDACTED]' },
      serializers: {
        req: (req: { id: unknown; method: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          path: stripQueryString(req.url),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => levelFor(res, error),
    },
  };
}
