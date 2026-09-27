import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from './helpers/test-app.js';

describe('GET /api/v1/health', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('confirma a conexão com o banco', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(resposta.body).toEqual({ data: { status: 'ok', database: 'ok' } });
  });
});
