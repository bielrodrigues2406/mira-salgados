import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AuthenticationError } from '../common/errors/domain.errors.js';
import type { Usuario } from '../usuarios/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AccessTokenService } from './access-token.service.js';
import { PasswordHasher } from '../usuarios/password-hasher.js';
import { type RefreshTokenEmitido, RefreshTokenService } from './refresh-token.service.js';

export interface SessaoEmitida {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  usuario: Usuario;
}

// Mesma mensagem para telefone sem conta, senha errada e conta desativada:
// respostas diferentes permitiriam descobrir quais telefones têm conta.
function credenciaisInvalidas(): AuthenticationError {
  return new AuthenticationError('CREDENCIAIS_INVALIDAS', 'Telefone ou senha incorretos.');
}

function sessaoInvalida(): AuthenticationError {
  return new AuthenticationError('SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) {}

  async login(telefone: string, senha: string): Promise<SessaoEmitida> {
    const usuario = await this.usuarios.buscarAtivoComSenha(telefone);
    const senhaConfere = await this.hasher.verify(usuario?.senhaHash, senha);
    if (!usuario || !senhaConfere) {
      this.logger.warn(
        { evento: 'login_recusado' },
        'Tentativa de login com credenciais inválidas',
      );
      throw credenciaisInvalidas();
    }

    if (this.hasher.needsRehash(usuario.senhaHash)) {
      await this.usuarios.atualizarSenhaHash(usuario.id, await this.hasher.hash(senha));
    }
    return this.emitirSessao(usuario, await this.refreshTokens.issue(usuario.id));
  }

  async refresh(refreshToken: string | undefined): Promise<SessaoEmitida> {
    if (!refreshToken) throw sessaoInvalida();

    const resultado = await this.refreshTokens.rotate(refreshToken);
    if (resultado.status === 'reused') {
      this.logger.warn(
        {
          evento: 'refresh_token_reutilizado',
          usuarioId: resultado.usuarioId,
          familyId: resultado.familyId,
        },
        'Refresh token reutilizado; todas as sessões da família foram revogadas',
      );
      throw sessaoInvalida();
    }
    if (resultado.status === 'invalid') throw sessaoInvalida();

    const usuario = await this.usuarios.buscarAtivoPorId(resultado.usuarioId);
    if (!usuario) {
      await this.refreshTokens.revokeFamily(resultado.familyId);
      throw sessaoInvalida();
    }
    return this.emitirSessao(usuario, resultado.emitido);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.refreshTokens.revokeFamilyOf(refreshToken);
  }

  /** Troca pela própria pessoa; a sessão atual continua e as outras são encerradas. */
  async trocarSenha(
    usuarioId: string,
    senhaAtual: string,
    novaSenha: string,
    refreshToken: string | undefined,
  ): Promise<Usuario> {
    const familia = refreshToken ? await this.refreshTokens.familiaDe(refreshToken) : null;
    return this.usuarios.trocarPropriaSenha(usuarioId, senhaAtual, novaSenha, familia);
  }

  private async emitirSessao(
    usuario: Usuario,
    refresh: RefreshTokenEmitido,
  ): Promise<SessaoEmitida> {
    const access = await this.accessTokens.sign(usuario.id);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      usuario,
    };
  }
}
