import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    setupFiles: ['test/setup.ts', 'test/integration/setup-env.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    // Os testes compartilham um banco real; rodar em série evita interferência entre arquivos.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
