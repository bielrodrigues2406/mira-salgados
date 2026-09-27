import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AUTH_MODE_KEY, type AuthMode } from '../../common/auth/usuario-autenticado.js';
import { AccessTokenService } from '../access-token.service.js';

const BEARER = /^Bearer\s+(\S+)$/i;

export function extrairBearer(authorization: string | undefined): string | undefined {
  return authorization ? BEARER.exec(authorization)?.[1] : undefined;
}

// Guard global: a identidade é verificada num único ponto, e os services
// recebem apenas o usuário já autenticado.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modo =
      this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'required';
    if (modo === 'public') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extrairBearer(request.headers.authorization);
    if (!token) {
      if (modo === 'optional') return true;
      throw new UnauthorizedException();
    }

    try {
      request.usuario = { id: await this.accessTokens.verify(token) };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
