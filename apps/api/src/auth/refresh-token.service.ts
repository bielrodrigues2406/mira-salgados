import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull, type Repository } from 'typeorm';

import type { Env } from '../config/env.schema.js';
import { RefreshToken } from './refresh-token.entity.js';

const UM_DIA_MS = 86_400_000;

export interface RefreshTokenEmitido {
  token: string;
  expiresAt: Date;
}

export type ResultadoRotacao =
  | { status: 'rotated'; usuarioId: string; familyId: string; emitido: RefreshTokenEmitido }
  | { status: 'reused'; usuarioId: string; familyId: string }
  | { status: 'invalid' };

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * UM_DIA_MS;
  }

  /** Emite um token numa família existente ou abre uma nova (login). */
  async issue(
    usuarioId: string,
    familyId: string = randomUUID(),
    manager: EntityManager = this.dataSource.manager,
  ): Promise<RefreshTokenEmitido> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await manager.insert(RefreshToken, {
      usuarioId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  /**
   * Troca o token por um novo da mesma família. A linha do token é bloqueada
   * durante a transação, para que duas renovações simultâneas com o mesmo token
   * não produzam dois sucessos. A revogação por reuso é confirmada antes de o
   * chamador recusar a requisição.
   */
  rotate(token: string): Promise<ResultadoRotacao> {
    return this.dataSource.transaction(async (manager): Promise<ResultadoRotacao> => {
      const atual = await manager.findOne(RefreshToken, {
        where: { tokenHash: hashRefreshToken(token) },
        lock: { mode: 'pessimistic_write' },
      });
      const agora = new Date();

      if (!atual || atual.revokedAt) return { status: 'invalid' };
      // Reuso é verificado antes da expiração: um token antigo reapresentado
      // indica cópia, e os tokens mais novos da família podem ainda estar válidos.
      if (atual.usedAt) {
        await this.revokeFamilyWith(manager, atual.familyId, agora);
        return { status: 'reused', usuarioId: atual.usuarioId, familyId: atual.familyId };
      }
      if (atual.expiresAt <= agora) return { status: 'invalid' };

      await manager.update(RefreshToken, { id: atual.id }, { usedAt: agora });
      const emitido = await this.issue(atual.usuarioId, atual.familyId, manager);
      return { status: 'rotated', usuarioId: atual.usuarioId, familyId: atual.familyId, emitido };
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeFamilyWith(this.dataSource.manager, familyId, new Date());
  }

  async revokeFamilyOf(token: string): Promise<void> {
    const atual = await this.tokens.findOneBy({ tokenHash: hashRefreshToken(token) });
    if (atual) await this.revokeFamily(atual.familyId);
  }

  private async revokeFamilyWith(
    manager: EntityManager,
    familyId: string,
    agora: Date,
  ): Promise<void> {
    await manager.update(RefreshToken, { familyId, revokedAt: IsNull() }, { revokedAt: agora });
  }
}
