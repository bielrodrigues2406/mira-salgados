import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QueryFailedError } from 'typeorm';

import {
  AuthenticationError,
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../errors/domain.errors.js';
import { ValidationFailedException } from '../validation/validation.js';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const INTERNAL_ERROR: NormalizedError = {
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'Erro interno. Tente novamente em instantes.',
};

// Mensagens de exceções do framework (rota inexistente, JSON malformado, guard
// negando acesso) vêm em inglês e às vezes citam detalhes internos. O cliente
// recebe sempre a mensagem padrão do status; só erros de domínio carregam texto
// próprio.
const BY_STATUS: Partial<Record<number, Omit<NormalizedError, 'status'>>> = {
  400: { code: 'BAD_REQUEST', message: 'Requisição inválida.' },
  401: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' },
  403: { code: 'FORBIDDEN', message: 'Acesso negado.' },
  404: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
  405: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  409: { code: 'CONFLICT', message: 'Conflito com o estado atual do recurso.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Conteúdo da requisição muito grande.' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Formato de conteúdo não suportado.' },
  422: { code: 'UNPROCESSABLE_ENTITY', message: 'Não foi possível processar a requisição.' },
  429: { code: 'RATE_LIMITED', message: 'Muitas requisições. Aguarde e tente novamente.' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.' },
};

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRES_SERIALIZATION_FAILURE = '40001';
const POSTGRES_INVALID_INPUT = new Set(['22P02', '22007', '22008']);

function byStatus(status: number): NormalizedError {
  const known = BY_STATUS[status];
  if (known) return { status, ...known };
  return status >= 500
    ? INTERNAL_ERROR
    : { status, code: 'HTTP_ERROR', message: 'Requisição inválida.' };
}

function domainStatus(error: DomainError): number {
  if (error instanceof BusinessRuleError) return 422;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof ForbiddenError) return 403;
  return 500;
}

function databaseErrorCode(error: { driverError: unknown }): string | undefined {
  const { driverError } = error;
  if (typeof driverError === 'object' && driverError !== null && 'code' in driverError) {
    return String(driverError.code);
  }
  return undefined;
}

function fromDatabase(error: { driverError: unknown }): NormalizedError {
  const code = databaseErrorCode(error);
  if (code === POSTGRES_UNIQUE_VIOLATION) {
    return { status: 409, code: 'CONFLICT', message: 'Já existe um registro com esses dados.' };
  }
  if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'A operação viola a referência entre registros.',
    };
  }
  if (code === POSTGRES_SERIALIZATION_FAILURE) {
    return {
      status: 409,
      code: 'CONCURRENT_UPDATE',
      message: 'O registro foi alterado ao mesmo tempo por outra operação. Tente novamente.',
    };
  }
  if (code !== undefined && POSTGRES_INVALID_INPUT.has(code)) return byStatus(400);
  return INTERNAL_ERROR;
}

// Erros do body-parser (JSON malformado, corpo grande demais) seguem o formato
// do pacote http-errors e não são HttpException.
function isExpressClientError(error: unknown): error is { status: number } {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { status?: unknown; expose?: unknown };
  return (
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  );
}

export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof DomainError) {
    return {
      status: domainStatus(exception),
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }
  if (exception instanceof ValidationFailedException) {
    return {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: exception.message,
      details: exception.fieldErrors,
    };
  }
  if (exception instanceof HttpException) return byStatus(exception.getStatus());
  if (exception instanceof QueryFailedError) return fromDatabase(exception);
  if (isExpressClientError(exception)) return byStatus(exception.status);
  return INTERNAL_ERROR;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const error = normalizeError(exception);
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    if (error.status >= 500) {
      this.logger.error(
        { err: exception, requestId, method: request.method, path: request.path },
        'Erro não tratado ao processar a requisição',
      );
    } else if (exception instanceof QueryFailedError) {
      // Só o código do PostgreSQL: a mensagem do banco pode conter valores da linha.
      this.logger.warn(
        { requestId, databaseCode: databaseErrorCode(exception) },
        'Violação de restrição do banco convertida em erro de cliente',
      );
    }

    const body: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        ...(requestId === undefined ? {} : { requestId }),
      },
    };
    response.status(error.status).json(body);
  }
}
