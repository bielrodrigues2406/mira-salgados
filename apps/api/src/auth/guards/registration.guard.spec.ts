import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.schema.js';
import { RegistrationGuard } from './registration.guard.js';

function montar(cadastroPublico: boolean, usuario?: { id: string }) {
  const config = { get: () => cadastroPublico } as unknown as ConfigService<Env, true>;
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ usuario }) }),
  } as unknown as ExecutionContext;
  return { guard: new RegistrationGuard(config), context };
}

describe('RegistrationGuard', () => {
  it('recusa visitante anônimo quando o cadastro público está desligado', () => {
    const { guard, context } = montar(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('permite que um usuário autenticado cadastre outro', () => {
    const { guard, context } = montar(false, { id: 'u1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite visitante anônimo quando o cadastro público está ligado', () => {
    const { guard, context } = montar(true);

    expect(guard.canActivate(context)).toBe(true);
  });
});
