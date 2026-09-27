import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/** Identidade anexada à requisição pelo guard de autenticação. */
export interface UsuarioAutenticado {
  id: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioAutenticado;
  }
}

// Toda rota exige autenticação por padrão; exceções são declaradas na própria
// rota. Uma autorização por papel futura entra como outro guard global lendo
// outro metadado, sem tocar nos services.
export const AUTH_MODE_KEY = 'authMode';
export type AuthMode = 'required' | 'optional' | 'public';

/** Rota acessível sem autenticação. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(AUTH_MODE_KEY, 'public');

/** Autentica se houver token, mas não exige. Token inválido continua sendo recusado. */
export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTH_MODE_KEY, 'optional');

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const usuario = context.switchToHttp().getRequest<Request>().usuario;
    if (!usuario) throw new UnauthorizedException();
    return usuario;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado | undefined =>
    context.switchToHttp().getRequest<Request>().usuario,
);
