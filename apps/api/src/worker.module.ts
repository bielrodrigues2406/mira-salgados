import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { Cliente } from './clientes/cliente.entity.js';
import { loggerParams } from './common/logging/logger.config.js';
import { type Env, validateEnv } from './config/env.schema.js';
import { typeOrmOptions } from './database/typeorm.options.js';
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';
import { ChaveIdempotencia } from './pedidos/chave-idempotencia.entity.js';
import { ItemPedido } from './pedidos/itens/item-pedido.entity.js';
import { Pagamento } from './pedidos/pagamentos/pagamento.entity.js';
import { Pedido } from './pedidos/pedido.entity.js';
import { Produtor } from './produtores/produtor.entity.js';
import { PrecoProduto } from './produtos/preco-produto.entity.js';
import { Produto } from './produtos/produto.entity.js';
import { Usuario } from './usuarios/usuario.entity.js';

/**
 * Módulo raiz do processo isolado `worker` (dist/worker.js). Usa pool pequeno
 * de conexões PostgreSQL e não sobe servidor HTTP público.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
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
        extra: { max: 3 },
      }),
    }),
    TypeOrmModule.forFeature([
      Usuario,
      Cliente,
      Produtor,
      Produto,
      PrecoProduto,
      Pedido,
      ItemPedido,
      Pagamento,
      ChaveIdempotencia,
    ]),
    AuditoriaModule,
    NotificacoesModule,
  ],
})
export class WorkerModule {}
