import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { typeOrmOptions } from '../../src/database/typeorm.options.js';
import { loadTestEnv } from './test-env.js';

// Recria o esquema do zero e aplica todas as migrations, garantindo que os
// testes rodem sobre o mesmo esquema que a produção receberia.
export async function setup(): Promise<void> {
  loadTestEnv();
  const dataSource = new DataSource(typeOrmOptions(process.env['DATABASE_URL'] ?? ''));
  await dataSource.initialize();
  try {
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
