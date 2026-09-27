import { type ArgumentsHost, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../errors/domain.errors.js';
import { ValidationFailedException } from '../validation/validation.js';
import { AllExceptionsFilter, type ErrorBody, normalizeError } from './all-exceptions.filter.js';

function erroDeBanco(code: string, message: string): QueryFailedError {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error(message), { code }));
}

describe('normalizeError', () => {
  it('traduz violação de regra de negócio em 422 com código e detalhes', () => {
    const erro = new BusinessRuleError(
      'PEDIDO_SEM_ITENS',
      'O pedido precisa de ao menos um item.',
      {
        pedidoId: 'abc',
      },
    );

    expect(normalizeError(erro)).toEqual({
      status: 422,
      code: 'PEDIDO_SEM_ITENS',
      message: 'O pedido precisa de ao menos um item.',
      details: { pedidoId: 'abc' },
    });
  });

  it.each([
    [new NotFoundError('Cliente'), 404, 'Cliente não encontrado.'],
    [new ConflictError('EMAIL_EM_USO', 'E-mail já cadastrado.'), 409, 'E-mail já cadastrado.'],
    [
      new AuthenticationError('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.'),
      401,
      'E-mail ou senha incorretos.',
    ],
  ])('mapeia %o para %i', (erro, status, message) => {
    expect(normalizeError(erro)).toMatchObject({ status, message });
  });

  it('expõe os campos inválidos da validação', () => {
    const erro = new ValidationFailedException([{ field: 'nome', messages: ['obrigatório'] }]);

    expect(normalizeError(erro)).toEqual({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Os dados enviados são inválidos.',
      details: [{ field: 'nome', messages: ['obrigatório'] }],
    });
  });

  it('substitui mensagens do framework pela mensagem padrão do status', () => {
    expect(normalizeError(new NotFoundException('Cannot GET /api/v1/segredo'))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
    });
    expect(normalizeError(new UnauthorizedException())).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('converte duplicidade de chave em 409 sem vazar a mensagem do banco', () => {
    const resultado = normalizeError(
      erroDeBanco('23505', 'Key (email)=(ana@exemplo.com) already exists.'),
    );

    expect(resultado).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'Já existe um registro com esses dados.',
    });
    expect(JSON.stringify(resultado)).not.toContain('ana@exemplo.com');
  });

  it('trata falhas desconhecidas do banco como erro interno', () => {
    expect(normalizeError(erroDeBanco('53300', 'too many connections'))).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('trata JSON malformado do body-parser como 400', () => {
    const erro = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      expose: true,
      type: 'entity.parse.failed',
    });

    expect(normalizeError(erro)).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });

  it('trata qualquer outra exceção como erro interno genérico', () => {
    expect(normalizeError(new TypeError('x is undefined'))).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno. Tente novamente em instantes.',
    });
  });
});

describe('AllExceptionsFilter', () => {
  function executar(exception: unknown) {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-1', method: 'POST', path: '/api/v1/pedidos' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter(logger as unknown as PinoLogger).catch(exception, host);

    const corpo = json.mock.calls[0]?.[0] as ErrorBody;
    return { logger, status, corpo };
  }

  it('responde com o envelope de erro e o identificador da requisição', () => {
    const { status, corpo } = executar(new NotFoundError('Pedido'));

    expect(status).toHaveBeenCalledWith(404);
    expect(corpo).toEqual({
      error: { code: 'NOT_FOUND', message: 'Pedido não encontrado.', requestId: 'req-1' },
    });
  });

  it('registra o erro completo no log e não o devolve ao cliente', () => {
    const falha = new Error('connection terminated unexpectedly');
    const { logger, corpo } = executar(falha);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: falha, requestId: 'req-1' }),
      expect.any(String),
    );
    expect(JSON.stringify(corpo)).not.toContain('connection terminated');
    expect(JSON.stringify(corpo)).not.toContain('stack');
  });
});
