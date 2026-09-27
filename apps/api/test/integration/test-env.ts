import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(import.meta.dirname, '../../.env.test');

// Monta o ambiente dos testes de integração: banco dedicado, logs silenciosos e
// valores fixos para o restante. O banco de teste é apagado a cada execução,
// então nunca pode ser o banco de desenvolvimento.
export function loadTestEnv(): void {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

  const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
  if (!testDatabaseUrl) {
    throw new Error('Defina TEST_DATABASE_URL (veja apps/api/.env.test.example).');
  }
  if (!new URL(testDatabaseUrl).pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL precisa apontar para um banco cujo nome termine em _test.');
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    CORS_ORIGINS: 'http://localhost:4200',
    LOG_LEVEL: 'silent',
    JWT_ACCESS_SECRET: 'segredo-exclusivo-dos-testes-de-integracao-0123456789',
    // Um proxy confiável: cada teste usa um X-Forwarded-For próprio, e os limites
    // de taxa por IP não interferem entre testes.
    TRUST_PROXY: '1',
  });
}
