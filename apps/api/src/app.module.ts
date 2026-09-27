import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { loggerParams } from './common/logging/logger.config.js';
import { createValidationPipe } from './common/validation/validation.js';
import { type Env, validateEnv } from './config/env.schema.js';
import { typeOrmOptions } from './database/typeorm.options.js';
import { HealthModule } from './health/health.module.js';
import { ProdutoresModule } from './produtores/produtores.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Nos testes o ambiente é montado pelo próprio teste, sem ler arquivo.
      ignoreEnvFile: process.env['NODE_ENV'] === 'test',
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        loggerParams(config.get('LOG_LEVEL', { infer: true })),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...typeOrmOptions(config.get('DATABASE_URL', { infer: true })),
        autoLoadEntities: true,
      }),
    }),
    // Limite geral por IP; as rotas de autenticação aplicam limites mais baixos.
    // Armazenamento em memória basta com uma única instância da API.
    ThrottlerModule.forRoot({ throttlers: [{ name: 'padrao', ttl: 60_000, limit: 300 }] }),
    AuditoriaModule,
    UsuariosModule,
    AuthModule,
    HealthModule,
    ProdutoresModule,
  ],
  providers: [
    // A ordem importa: excesso de requisições é recusado antes de qualquer
    // verificação criptográfica de token.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
