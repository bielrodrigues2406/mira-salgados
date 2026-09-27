import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';

import type { Env } from '../config/env.schema.js';
import { AccessTokenService } from './access-token.service.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const USUARIO_ID = '3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60';

function criarServico(segredo = SEGREDO): AccessTokenService {
  const valores: Partial<Env> = { JWT_ACCESS_SECRET: segredo, JWT_ACCESS_TTL_SECONDS: 900 };
  const config = { get: (chave: keyof Env) => valores[chave] } as ConfigService<Env, true>;
  return new AccessTokenService(new JwtService(), config);
}

function base64url(objeto: object): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

describe('AccessTokenService', () => {
  const servico = criarServico();

  it('emite token que identifica o usuário e informa a validade', async () => {
    const { token, expiresIn } = await servico.sign(USUARIO_ID);

    expect(expiresIn).toBe(900);
    await expect(servico.verify(token)).resolves.toBe(USUARIO_ID);
  });

  it('recusa token assinado com outro segredo', async () => {
    const { token } = await criarServico('outro-segredo-tambem-com-mais-de-32-chars').sign(
      USUARIO_ID,
    );

    await expect(servico.verify(token)).rejects.toThrow();
  });

  it('recusa token com algoritmo "none"', async () => {
    const semAssinatura = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: USUARIO_ID,
      iss: 'mira-salgados-api',
      aud: 'mira-salgados-web',
    })}.`;

    await expect(servico.verify(semAssinatura)).rejects.toThrow();
  });

  it('recusa token de outro emissor ou público', async () => {
    const jwt = new JwtService();
    const token = await jwt.signAsync(
      { sub: USUARIO_ID },
      {
        secret: SEGREDO,
        algorithm: 'HS256',
        issuer: 'outro-sistema',
        audience: 'mira-salgados-web',
      },
    );

    await expect(servico.verify(token)).rejects.toThrow();
  });

  it('recusa token expirado', async () => {
    const jwt = new JwtService();
    const token = await jwt.signAsync(
      { sub: USUARIO_ID, exp: Math.floor(Date.now() / 1000) - 10 },
      {
        secret: SEGREDO,
        algorithm: 'HS256',
        issuer: 'mira-salgados-api',
        audience: 'mira-salgados-web',
      },
    );

    await expect(servico.verify(token)).rejects.toThrow();
  });
});
