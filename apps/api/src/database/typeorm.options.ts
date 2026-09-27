import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions.js';

import { migrations } from './migrations/index.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

export function typeOrmOptions(databaseUrl: string): PostgresDataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    namingStrategy: new SnakeNamingStrategy(),
    // gen_random_uuid() é nativa desde o PostgreSQL 13; nenhuma extensão é instalada.
    uuidExtension: 'pgcrypto',
    migrations,
    migrationsTableName: 'migrations',
    // O esquema muda apenas por migration, em todos os ambientes. Sincronização
    // automática faz o banco local divergir do de produção sem deixar rastro.
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
  };
}
