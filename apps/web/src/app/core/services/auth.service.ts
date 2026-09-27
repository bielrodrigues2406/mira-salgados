import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  type Observable,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../models/api';
import type { ConfiguracaoAuth, NovoUsuario, SessaoResposta, Usuario } from '../models/usuario';

interface Sessao {
  accessToken: string;
  usuario: Usuario;
}

const AUTH = `${environment.apiUrl}/auth`;

// O access token fica só em memória: um script injetado não o encontra em
// localStorage, e o refresh token vive num cookie httpOnly que o JavaScript não
// lê. Ao recarregar a página, a sessão é restaurada pelo cookie.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessao = signal<Sessao | null>(null);
  private renovacaoEmCurso: Observable<string> | null = null;

  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly autenticado = computed(() => this.sessao() !== null);

  accessToken(): string | null {
    return this.sessao()?.accessToken ?? null;
  }

  configuracao(): Observable<ConfiguracaoAuth> {
    return this.http
      .get<ApiEnvelope<ConfiguracaoAuth>>(`${AUTH}/configuracao`)
      .pipe(map(({ data }) => data));
  }

  login(email: string, senha: string): Observable<Usuario> {
    return this.http
      .post<ApiEnvelope<SessaoResposta>>(`${AUTH}/login`, { email, senha })
      .pipe(map(({ data }) => this.iniciarSessao(data)));
  }

  registrar(dados: NovoUsuario): Observable<Usuario> {
    return this.http
      .post<ApiEnvelope<Usuario>>(`${AUTH}/registro`, dados)
      .pipe(map(({ data }) => data));
  }

  /**
   * Troca o refresh token por um novo access token. Chamadas simultâneas
   * compartilham a mesma requisição: o servidor trata a reapresentação de um
   * refresh token já usado como roubo e revoga a sessão inteira.
   */
  renovar(): Observable<string> {
    this.renovacaoEmCurso ??= this.http
      .post<ApiEnvelope<SessaoResposta>>(`${AUTH}/refresh`, null)
      .pipe(
        map(({ data }) => {
          this.iniciarSessao(data);
          return data.accessToken;
        }),
        catchError((erro: unknown) => {
          this.sessao.set(null);
          return throwError(() => erro);
        }),
        finalize(() => {
          this.renovacaoEmCurso = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.renovacaoEmCurso;
  }

  /** Executado antes da primeira navegação; sem cookie válido, segue deslogado. */
  async restaurarSessao(): Promise<void> {
    await firstValueFrom(this.renovar().pipe(catchError(() => of(null))));
  }

  logout(): Observable<void> {
    return this.http.post<null>(`${AUTH}/logout`, null).pipe(
      catchError(() => of(undefined)),
      tap(() => {
        this.encerrarSessaoLocal();
      }),
      map(() => undefined),
    );
  }

  /** Chamado quando a renovação falha no meio do uso. */
  expirarSessao(): void {
    this.encerrarSessaoLocal({ motivo: 'sessao-expirada' });
  }

  private iniciarSessao(resposta: SessaoResposta): Usuario {
    this.sessao.set({ accessToken: resposta.accessToken, usuario: resposta.usuario });
    return resposta.usuario;
  }

  private encerrarSessaoLocal(queryParams?: Record<string, string>): void {
    this.sessao.set(null);
    void this.router.navigate(['/entrar'], queryParams ? { queryParams } : {});
  }
}
