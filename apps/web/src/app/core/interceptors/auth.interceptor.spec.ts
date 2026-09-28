import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const USUARIO = {
  id: '1',
  nome: 'Lúcia Andrade',
  telefone: '11987654321',
  papel: 'MEMBRO',
  trocarSenha: false,
  ativo: true,
  criadoEm: '2026-10-01T00:00:00.000Z',
};

function sessao(accessToken: string) {
  return { data: { accessToken, tokenType: 'Bearer', expiresIn: 900, usuario: USUARIO } };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    const login = firstValueFrom(auth.login('11987654321', 'senha'));
    backend.expectOne('/api/v1/auth/login').flush(sessao('token-antigo'));
    await login;
  });

  afterEach(() => {
    backend.verify();
  });

  it('anexa o access token às chamadas da API', () => {
    http.get('/api/v1/clientes').subscribe();

    const requisicao = backend.expectOne('/api/v1/clientes');
    expect(requisicao.request.headers.get('Authorization')).toBe('Bearer token-antigo');
    requisicao.flush({ data: [] });
  });

  it('não envia o token para outras origens nem para rotas de sessão', () => {
    http.get('https://outro-site.exemplo/dados').subscribe();
    http.post('/api/v1/auth/logout', null).subscribe();

    expect(
      backend.expectOne('https://outro-site.exemplo/dados').request.headers.has('Authorization'),
    ).toBe(false);
    expect(backend.expectOne('/api/v1/auth/logout').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('renova uma única vez para requisições paralelas e repete todas com o novo token', async () => {
    const primeira = firstValueFrom(http.get<{ data: string }>('/api/v1/pedidos'));
    const segunda = firstValueFrom(http.get<{ data: string }>('/api/v1/clientes'));

    backend.expectOne('/api/v1/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/clientes').flush(null, { status: 401, statusText: 'Unauthorized' });

    // Uma só renovação, embora duas requisições tenham recebido 401.
    backend.expectOne('/api/v1/auth/refresh').flush(sessao('token-novo'));

    const repetidas = backend.match((requisicao) => requisicao.url.startsWith('/api/v1/'));
    expect(repetidas.map((r) => r.request.headers.get('Authorization'))).toEqual([
      'Bearer token-novo',
      'Bearer token-novo',
    ]);
    for (const requisicao of repetidas) requisicao.flush({ data: 'ok' });

    await expect(primeira).resolves.toEqual({ data: 'ok' });
    await expect(segunda).resolves.toEqual({ data: 'ok' });
    expect(auth.accessToken()).toBe('token-novo');
  });

  it('encerra a sessão e leva ao login quando a renovação falha', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const chamada = firstValueFrom(http.get('/api/v1/pedidos'));

    backend.expectOne('/api/v1/pedidos').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(
        { error: { code: 'SESSAO_INVALIDA', message: 'Sua sessão expirou. Entre novamente.' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(chamada).rejects.toBeTruthy();
    expect(auth.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/entrar'], {
      queryParams: { motivo: 'sessao-expirada' },
    });
  });

  it('repassa erros que não são 401 sem tentar renovar', async () => {
    const chamada = firstValueFrom(http.get('/api/v1/pedidos'));

    backend.expectOne('/api/v1/pedidos').flush(null, { status: 422, statusText: 'Unprocessable' });

    await expect(chamada).rejects.toMatchObject({ status: 422 });
    backend.expectNone('/api/v1/auth/refresh');
  });
});
