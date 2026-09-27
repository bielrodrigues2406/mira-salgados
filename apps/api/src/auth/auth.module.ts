import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RefreshCookie } from './refresh-cookie.js';
import { RefreshToken } from './refresh-token.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  // O segredo e as opções de assinatura são passados a cada chamada pelo
  // AccessTokenService; o módulo não registra segredo padrão.
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([RefreshToken]), UsuariosModule],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenService, RefreshTokenService, RefreshCookie, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
