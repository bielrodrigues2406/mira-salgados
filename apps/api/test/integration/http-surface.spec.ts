import { Body, Controller, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Public } from '../../src/common/auth/usuario-autenticado.js';
import { BusinessRuleError } from '../../src/common/errors/domain.errors.js';
import type { ErrorBody } from '../../src/common/filters/all-exceptions.filter.js';
import { createTestApp } from './helpers/test-app.js';

class CriarExemploDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsInt()
  @Min(1)
  quantidade: number;
}

@Controller('exemplos')
@Public()
class ExemploController {
  @Post()
  criar(@Body() dto: CriarExemploDto): CriarExemploDto {
    return dto;
  }

  @Post('regra')
  violarRegra(): never {
    throw new BusinessRuleError('REGRA_DE_EXEMPLO', 'A regra de exemplo foi violada.');
  }

  @Post('falha')
  falhar(): never {
    throw new Error('detalhe interno que não pode vazar');
  }
}

function erroDe(resposta: request.Response): ErrorBody['error'] {
  return (resposta.body as ErrorBody).error;
}

describe('superfície HTTP', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp([ExemploController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('envolve a resposta de sucesso no envelope data', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/v1/exemplos')
      .send({ nome: 'Coxinha', quantidade: 2 })
      .expect(201);

    expect(resposta.body).toEqual({ data: { nome: 'Coxinha', quantidade: 2 } });
  });

  it('rejeita propriedades não declaradas no DTO com 400', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/v1/exemplos')
      .send({ nome: 'Coxinha', quantidade: 2, precoUnitario: 1 })
      .expect(400);

    expect(erroDe(resposta)).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'precoUnitario', messages: ['O campo "precoUnitario" não é permitido.'] }],
    });
  });

  it('distingue regra de negócio (422) de entrada malformada (400)', async () => {
    const resposta = await request(app.getHttpServer()).post('/api/v1/exemplos/regra').expect(422);

    expect(erroDe(resposta)).toMatchObject({
      code: 'REGRA_DE_EXEMPLO',
      message: 'A regra de exemplo foi violada.',
    });
  });

  it('responde 400 a JSON malformado em vez de erro interno', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/v1/exemplos')
      .set('Content-Type', 'application/json')
      .send('{"nome": ')
      .expect(400);

    expect(erroDe(resposta).code).toBe('BAD_REQUEST');
  });

  it('não devolve stack trace nem mensagem interna em falhas inesperadas', async () => {
    const resposta = await request(app.getHttpServer()).post('/api/v1/exemplos/falha').expect(500);

    expect(erroDe(resposta).code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(resposta.body)).not.toContain('detalhe interno');
  });

  it('responde 404 em português para rotas inexistentes', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/nao-existe').expect(404);

    expect(erroDe(resposta)).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
    });
  });

  it('aplica cabeçalhos de segurança e identifica a requisição', async () => {
    const resposta = await request(app.getHttpServer()).get('/api/v1/health');

    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['x-powered-by']).toBeUndefined();
    expect(resposta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('libera CORS apenas para a origem configurada', async () => {
    const permitida = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:4200');
    const negada = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://site-malicioso.exemplo');

    expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(permitida.headers['access-control-allow-credentials']).toBe('true');
    expect(negada.headers['access-control-allow-origin']).toBeUndefined();
  });
});
