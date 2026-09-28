import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';

const USUARIO = {
  id: '1',
  nome: 'Lúcia Andrade',
  telefone: '11987654321',
  papel: 'MEMBRO',
  trocarSenha: false,
  ativo: true,
  criadoEm: '2026-10-01T00:00:00.000Z',
};
const SESSAO = {
  data: { accessToken: 'token', tokenType: 'Bearer', expiresIn: 900, usuario: USUARIO },
};

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('começa deslogado', () => {
    expect(auth.autenticado()).toBe(false);
    expect(auth.usuario()).toBeNull();
  });

  it('guarda o usuário e o token em memória após o login', async () => {
    const login = firstValueFrom(auth.login('11987654321', 'senha'));
    const requisicao = backend.expectOne('/api/v1/auth/login');
    expect(requisicao.request.body).toEqual({ telefone: '11987654321', senha: 'senha' });
    requisicao.flush(SESSAO);

    await expect(login).resolves.toEqual(USUARIO);
    expect(auth.autenticado()).toBe(true);
    expect(auth.accessToken()).toBe('token');
  });

  it('restaura a sessão pelo cookie ao iniciar', async () => {
    const restauracao = auth.restaurarSessao();
    backend.expectOne('/api/v1/auth/refresh').flush(SESSAO);
    await restauracao;

    expect(auth.usuario()).toEqual(USUARIO);
  });

  it('segue deslogado, sem erro, quando não há sessão para restaurar', async () => {
    const restauracao = auth.restaurarSessao();
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(restauracao).resolves.toBeUndefined();
    expect(auth.autenticado()).toBe(false);
  });

  it('encerra a sessão local mesmo se o logout falhar no servidor', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const login = firstValueFrom(auth.login('11987654321', 'senha'));
    backend.expectOne('/api/v1/auth/login').flush(SESSAO);
    await login;

    const saida = firstValueFrom(auth.logout());
    backend.expectOne('/api/v1/auth/logout').flush(null, { status: 0, statusText: 'offline' });
    await saida;

    expect(auth.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/entrar'], {});
  });

  it('troca a senha e libera a conta que estava com senha provisória', async () => {
    const login = firstValueFrom(auth.login('11987654321', 'provisoria'));
    backend.expectOne('/api/v1/auth/login').flush({
      data: { ...SESSAO.data, usuario: { ...USUARIO, papel: 'ADMIN', trocarSenha: true } },
    });
    await login;
    expect(auth.precisaTrocarSenha()).toBe(true);
    expect(auth.ehAdmin()).toBe(true);

    const troca = firstValueFrom(auth.trocarSenha('provisoria', 'nova-senha-longa'));
    const requisicao = backend.expectOne('/api/v1/auth/senha');
    expect(requisicao.request.method).toBe('PATCH');
    expect(requisicao.request.body).toEqual({
      senhaAtual: 'provisoria',
      novaSenha: 'nova-senha-longa',
    });
    requisicao.flush({ data: { ...USUARIO, papel: 'ADMIN' } });
    await troca;

    expect(auth.precisaTrocarSenha()).toBe(false);
    expect(auth.accessToken()).toBe('token');
  });
});
