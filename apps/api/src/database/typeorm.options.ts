import type { DataSourceOptions } from 'typeorm';

import { migrations } from './migrations/index.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

export function typeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    namingStrategy: new SnakeNamingStrategy(),
    migrations,
    migrationsTableName: 'migrations',
    // O esquema muda apenas por migration, em todos os ambientes. Sincronização
    // automática faz o banco local divergir do de produção sem deixar rastro.
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
  };
}
