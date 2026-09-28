import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { Papel } from '../../usuarios/papeis.js';

/** Identidade anexada à requisição pelo guard de autenticação, lida do banco a cada requisição. */
export interface UsuarioAutenticado {
  id: string;
  papel: Papel;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioAutenticado;
  }
}

// Toda rota exige autenticação por padrão; exceções e exigências extras são
// declaradas na própria rota e verificadas num único guard global.
export const AUTH_MODE_KEY = 'authMode';
export const SOMENTE_ADMIN_KEY = 'somenteAdmin';
export const PERMITE_SENHA_PROVISORIA_KEY = 'permiteSenhaProvisoria';

/** Rota acessível sem autenticação. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(AUTH_MODE_KEY, 'public');

/** Só administradores: usuários, histórico de alterações. */
export const SomenteAdmin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SOMENTE_ADMIN_KEY, true);

/**
 * Rota liberada para quem ainda está com senha provisória. Todas as outras
 * respondem 403 até a senha ser trocada.
 */
export const PermiteSenhaProvisoria = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMITE_SENHA_PROVISORIA_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const usuario = context.switchToHttp().getRequest<Request>().usuario;
    if (!usuario) throw new UnauthorizedException();
    return usuario;
  },
);
