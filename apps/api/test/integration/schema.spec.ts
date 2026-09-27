import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './helpers/test-app.js';

// O banco de teste é criado exclusivamente pelas migrations. Se alguma entidade
// declarar coluna, índice ou restrição que as migrations não criam (ou o
// contrário), o TypeORM gera SQL de ajuste e este teste falha: a divergência é
// descoberta aqui, e não em produção.
describe('esquema do banco', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('corresponde exatamente às entidades', async () => {
    const pendencias = await app.get(DataSource).driver.createSchemaBuilder().log();

    expect(pendencias.upQueries.map((consulta) => consulta.query)).toEqual([]);
  });
});
