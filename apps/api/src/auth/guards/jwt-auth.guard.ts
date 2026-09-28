import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  AUTH_MODE_KEY,
  PERMITE_SENHA_PROVISORIA_KEY,
  SOMENTE_ADMIN_KEY,
} from '../../common/auth/usuario-autenticado.js';
import { ForbiddenError } from '../../common/errors/domain.errors.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import { AccessTokenService } from '../access-token.service.js';

const BEARER = /^Bearer\s+(\S+)$/i;

export function extrairBearer(authorization: string | undefined): string | undefined {
  return authorization ? BEARER.exec(authorization)?.[1] : undefined;
}

// Guard global: identidade e permissão são verificadas num único ponto, e os
// services recebem apenas o usuário já autenticado. A conta é relida do banco a
// cada requisição: desativar alguém ou trocar o papel vale na hora, sem esperar
// o token de acesso expirar.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.metadado(context, AUTH_MODE_KEY) === 'public') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extrairBearer(request.headers.authorization);
    if (!token) throw new UnauthorizedException();

    let usuarioId: string;
    try {
      usuarioId = await this.accessTokens.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    const usuario = await this.usuarios.buscarAtivoPorId(usuarioId);
    if (!usuario) throw new UnauthorizedException();
    request.usuario = { id: usuario.id, papel: usuario.papel };

    if (usuario.trocarSenha && this.metadado(context, PERMITE_SENHA_PROVISORIA_KEY) !== true) {
      throw new ForbiddenError(
        'TROCA_DE_SENHA_OBRIGATORIA',
        'Troque a senha provisória antes de continuar.',
      );
    }
    if (this.metadado(context, SOMENTE_ADMIN_KEY) === true && usuario.papel !== 'ADMIN') {
      throw new ForbiddenError('SOMENTE_ADMIN', 'Apenas administradores podem fazer isso.');
    }
    return true;
  }

  private metadado(context: ExecutionContext, chave: string): unknown {
    return this.reflector.getAllAndOverride<unknown>(chave, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
