import {
  HttpErrorResponse,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

// Rotas de sessão não levam access token e não disparam renovação: um 401 em
// login ou refresh é resposta definitiva, não sinal de token vencido.
const ROTAS_DE_SESSAO = /\/auth\/(login|refresh|logout|configuracao)$/;

function comToken(requisicao: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return requisicao.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (
  requisicao: HttpRequest<unknown>,
  proximo: HttpHandlerFn,
) => {
  if (!requisicao.url.startsWith(environment.apiUrl) || ROTAS_DE_SESSAO.test(requisicao.url)) {
    return proximo(requisicao);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();
  const enviada = token ? comToken(requisicao, token) : requisicao;

  return proximo(enviada).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401 || !token) {
        return throwError(() => erro);
      }
      // Access token vencido: renova uma única vez (requisições paralelas
      // aguardam a mesma renovação) e repete a requisição original.
      return auth.renovar().pipe(
        catchError((falha: unknown) => {
          auth.expirarSessao();
          return throwError(() => falha);
        }),
        switchMap((novoToken) => proximo(comToken(requisicao, novoToken))),
      );
    }),
  );
};
