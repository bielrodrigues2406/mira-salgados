import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AuthMode } from '../../common/auth/usuario-autenticado.js';
import type { AccessTokenService } from '../access-token.service.js';
import { extrairBearer, JwtAuthGuard } from './jwt-auth.guard.js';

const USUARIO_ID = '3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60';

function montar(modo: AuthMode | undefined, authorization?: string) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(modo);
  const accessTokens = {
    verify: vi.fn((token: string) =>
      token === 'valido' ? Promise.resolve(USUARIO_ID) : Promise.reject(new Error('inválido')),
    ),
  };
  const request = { headers: { authorization } } as Request;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new JwtAuthGuard(reflector, accessTokens as unknown as AccessTokenService);
  return { guard, context, request, accessTokens };
}

describe('JwtAuthGuard', () => {
  it('exige token por padrão', async () => {
    const { guard, context } = montar(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('libera rotas públicas sem verificar token', async () => {
    const { guard, context, accessTokens } = montar('public', 'Bearer invalido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(accessTokens.verify).not.toHaveBeenCalled();
  });

  it('anexa o usuário quando o token é válido', async () => {
    const { guard, context, request } = montar(undefined, 'Bearer valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.usuario).toEqual({ id: USUARIO_ID });
  });

  it('recusa token inválido', async () => {
    const { guard, context } = montar(undefined, 'Bearer adulterado');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('no modo opcional segue sem usuário quando não há token', async () => {
    const { guard, context, request } = montar('optional');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.usuario).toBeUndefined();
  });

  it('no modo opcional ainda recusa token inválido', async () => {
    const { guard, context } = montar('optional', 'Bearer adulterado');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('extrairBearer', () => {
  it.each([
    ['Bearer abc.def', 'abc.def'],
    ['bearer abc', 'abc'],
    ['Basic abc', undefined],
    ['Bearer', undefined],
    [undefined, undefined],
  ])('extrai o token de %s', (cabecalho, esperado) => {
    expect(extrairBearer(cabecalho)).toBe(esperado);
  });
});
