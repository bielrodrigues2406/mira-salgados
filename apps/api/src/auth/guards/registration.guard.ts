import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Env } from '../../config/env.schema.js';

// Cadastro aberto a qualquer visitante daria acesso a todos os dados a quem
// encontrasse a URL. Por padrão só um usuário autenticado cadastra outro; o
// cadastro público existe apenas para criar as primeiras contas e deve ser
// desligado em seguida.
@Injectable()
export class RegistrationGuard implements CanActivate {
  private readonly cadastroPublico: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.cadastroPublico = config.get('AUTH_PUBLIC_SIGNUP_ENABLED', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.cadastroPublico) return true;
    if (context.switchToHttp().getRequest<Request>().usuario) return true;
    throw new UnauthorizedException();
  }
}
