import 'reflect-metadata';

import { existsSync } from 'node:fs';

import { DataSource } from 'typeorm';

import { envSchema } from '../config/env.schema.js';
import { typeOrmOptions } from './typeorm.options.js';

// Ponto de entrada da CLI do TypeORM (migration:run, migration:revert). Em
// contêiner as variáveis vêm do ambiente; localmente, do arquivo .env.
if (existsSync('.env')) process.loadEnvFile('.env');

const { DATABASE_URL } = envSchema.pick({ DATABASE_URL: true }).parse(process.env);

export default new DataSource({
  ...typeOrmOptions(DATABASE_URL),
  entities: [`${import.meta.dirname}/../**/*.entity.js`],
});
