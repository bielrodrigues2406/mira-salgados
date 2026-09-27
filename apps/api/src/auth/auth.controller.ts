import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import {
  OptionalAuth,
  OptionalCurrentUser,
  Public,
  type UsuarioAutenticado,
} from '../common/auth/usuario-autenticado.js';
import { UsuarioRespostaDto } from '../usuarios/dto/usuario-resposta.dto.js';
import { AuthService, type ConfiguracaoPublica } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import { SessaoRespostaDto } from './dto/sessao-resposta.dto.js';
import { RegistrationGuard } from './guards/registration.guard.js';
import { RefreshCookie } from './refresh-cookie.js';

// Com quatro usuários, poucas tentativas por minuto e por IP bastam para o uso
// legítimo; qualquer volume acima disso é anomalia e é recusado com 429.
const LIMITE_CREDENCIAIS = { padrao: { limit: 5, ttl: 60_000 } };
const LIMITE_SESSAO = { padrao: { limit: 30, ttl: 60_000 } };

@Controller('auth')
@Throttle(LIMITE_SESSAO)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: RefreshCookie,
  ) {}

  @Public()
  @Get('configuracao')
  configuracao(): ConfiguracaoPublica {
    return this.auth.configuracaoPublica();
  }

  @Public()
  @Throttle(LIMITE_CREDENCIAIS)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessaoRespostaDto> {
    const sessao = await this.auth.login(dto.email, dto.senha);
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

  @OptionalAuth()
  @UseGuards(RegistrationGuard)
  @Throttle(LIMITE_CREDENCIAIS)
  @Post('registro')
  async registrar(
    @Body() dto: RegistroDto,
    @OptionalCurrentUser() autor: UsuarioAutenticado | undefined,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.auth.registrar(dto, autor?.id ?? null);
    return UsuarioRespostaDto.de(usuario);
  }
}
