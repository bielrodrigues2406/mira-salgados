import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_MODE_KEY,
  PERMITE_SENHA_PROVISORIA_KEY,
  SOMENTE_ADMIN_KEY,
} from '../../common/auth/usuario-autenticado.js';
import { ForbiddenError } from '../../common/errors/domain.errors.js';
import type { Papel } from '../../usuarios/papeis.js';
import type { UsuariosService } from '../../usuarios/usuarios.service.js';
import type { AccessTokenService } from '../access-token.service.js';
import { extrairBearer, JwtAuthGuard } from './jwt-auth.guard.js';

const USUARIO_ID = '3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60';

interface Cenario {
  metadados?: Record<string, unknown>;
  authorization?: string;
  conta?: { papel: Papel; trocarSenha?: boolean } | null;
}

function montar({ metadados = {}, authorization, conta = { papel: 'MEMBRO' } }: Cenario) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (chave) => metadados[chave as string],
  );
  const accessTokens = {
    verify: vi.fn((token: string) =>
      token === 'valido' ? Promise.resolve(USUARIO_ID) : Promise.reject(new Error('inválido')),
    ),
  };
  const usuarios = {
    buscarAtivoPorId: vi.fn(() =>
      Promise.resolve(
        conta && { id: USUARIO_ID, papel: conta.papel, trocarSenha: conta.trocarSenha ?? false },
      ),
    ),
  };
  const request = { headers: { authorization } } as Request;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new JwtAuthGuard(
    reflector,
    accessTokens as unknown as AccessTokenService,
    usuarios as unknown as UsuariosService,
  );
  return { guard, context, request, accessTokens, usuarios };
}

describe('JwtAuthGuard', () => {
  it('exige token por padrão', async () => {
    const { guard, context } = montar({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('libera rotas públicas sem verificar token', async () => {
    const { guard, context, accessTokens } = montar({
      metadados: { [AUTH_MODE_KEY]: 'public' },
      authorization: 'Bearer invalido',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(accessTokens.verify).not.toHaveBeenCalled();
  });

  it('anexa o usuário com o papel lido do banco', async () => {
    const { guard, context, request } = montar({
      authorization: 'Bearer valido',
      conta: { papel: 'ADMIN' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.usuario).toEqual({ id: USUARIO_ID, papel: 'ADMIN' });
  });

  it('recusa token inválido', async () => {
    const { guard, context } = montar({ authorization: 'Bearer adulterado' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token válido de conta desativada ou apagada', async () => {
    const { guard, context } = montar({ authorization: 'Bearer valido', conta: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa membro em rota só de administrador', async () => {
    const { guard, context } = montar({
      metadados: { [SOMENTE_ADMIN_KEY]: true },
      authorization: 'Bearer valido',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'SOMENTE_ADMIN' });
  });

  it('com senha provisória, só libera as rotas marcadas', async () => {
    const provisoria = { papel: 'ADMIN' as const, trocarSenha: true };
    const bloqueada = montar({ authorization: 'Bearer valido', conta: provisoria });
    await expect(bloqueada.guard.canActivate(bloqueada.context)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const liberada = montar({
      metadados: { [PERMITE_SENHA_PROVISORIA_KEY]: true },
      authorization: 'Bearer valido',
      conta: provisoria,
    });
    await expect(liberada.guard.canActivate(liberada.context)).resolves.toBe(true);
  });
});

describe('extrairBearer', () => {
  it('extrai o token do cabeçalho Authorization', () => {
    expect(extrairBearer('Bearer abc.def')).toBe('abc.def');
    expect(extrairBearer('bearer abc')).toBe('abc');
    expect(extrairBearer('Basic abc')).toBeUndefined();
    expect(extrairBearer(undefined)).toBeUndefined();
  });
});
