import { Body, Controller, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  CurrentUser,
  PermiteSenhaProvisoria,
  Public,
  type UsuarioAutenticado,
} from '../common/auth/usuario-autenticado.js';
import { UsuarioRespostaDto } from '../usuarios/dto/usuario-resposta.dto.js';
import { TrocarSenhaDto } from '../usuarios/dto/usuarios.dto.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SessaoRespostaDto } from './dto/sessao-resposta.dto.js';
import { RefreshCookie } from './refresh-cookie.js';

// Com poucos usuários, poucas tentativas por minuto e por IP bastam para o uso
// legítimo; qualquer volume acima disso é anomalia e é recusado com 429.
const LIMITE_CREDENCIAIS = { padrao: { limit: 5, ttl: 60_000 } };
const LIMITE_SESSAO = { padrao: { limit: 30, ttl: 60_000 } };

// Não há cadastro público: contas são criadas por um administrador, e o
// primeiro administrador pelo comando `usuarios:criar-admin` (ADR 0013).
@Controller('auth')
@Throttle(LIMITE_SESSAO)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: RefreshCookie,
  ) {}

  @Public()
  @Throttle(LIMITE_CREDENCIAIS)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessaoRespostaDto> {
    const sessao = await this.auth.login(dto.telefone, dto.senha);
    this.cookie.write(response, sessao.refreshToken, sessao.refreshExpiresAt);
    return SessaoRespostaDto.de(sessao);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessaoRespostaDto> {
    try {
      const sessao = await this.auth.refresh(this.cookie.read(request));
      this.cookie.write(response, sessao.refreshToken, sessao.refreshExpiresAt);
      return SessaoRespostaDto.de(sessao);
    } catch (erro) {
      this.cookie.clear(response);
      throw erro;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookie.read(request));
    this.cookie.clear(response);
  }

  /** Única rota aberta a quem ainda está com senha provisória, além de sair. */
  @PermiteSenhaProvisoria()
  @Throttle(LIMITE_CREDENCIAIS)
  @Patch('senha')
  async trocarSenha(
    @Body() dto: TrocarSenhaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Req() request: Request,
  ): Promise<UsuarioRespostaDto> {
    const atualizado = await this.auth.trocarSenha(
      usuario.id,
      dto.senhaAtual,
      dto.novaSenha,
      this.cookie.read(request),
    );
    return UsuarioRespostaDto.de(atualizado);
  }
}
