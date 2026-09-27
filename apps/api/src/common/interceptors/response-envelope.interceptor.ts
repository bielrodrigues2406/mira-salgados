import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import { Paginated } from '../pagination/pagination.js';

export interface DataEnvelope<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
  /** Totais da coleção inteira, nos relatórios paginados. */
  resumo?: object;
}

export function wrapInEnvelope(body: unknown): DataEnvelope<unknown> | undefined {
  if (body === undefined) return undefined;
  if (body instanceof Paginated) {
    return {
      data: body.items,
      meta: {
        page: body.page,
        pageSize: body.pageSize,
        total: body.total,
        totalPages: body.totalPages,
      },
      ...(body.resumo === undefined ? {} : { resumo: body.resumo }),
    };
  }
  return { data: body };
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(wrapInEnvelope));
  }
}
