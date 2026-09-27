import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Env } from '../config/env.schema.js';

const ISSUER = 'mira-salgados-api';
const AUDIENCE = 'mira-salgados-web';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessTokenEmitido {
  token: string;
  expiresIn: number;
}

@Injectable()
export class AccessTokenService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  async sign(usuarioId: string): Promise<AccessTokenEmitido> {
    const token = await this.jwt.signAsync(
      {},
      {
        secret: this.secret,
        algorithm: 'HS256',
        expiresIn: this.ttlSeconds,
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: usuarioId,
      },
    );
    return { token, expiresIn: this.ttlSeconds };
  }

  /** Devolve o id do usuário ou lança erro se o token for inválido ou expirado. */
  async verify(token: string): Promise<string> {
    // O algoritmo é fixado na verificação: aceitar o que vem no cabeçalho do token
    // abre espaço para ataques de troca de algoritmo ("none", RS256 com a chave pública).
    const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token, {
      secret: this.secret,
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
      throw new Error('Token sem identificação de usuário válida.');
    }
    return payload.sub;
  }
}
