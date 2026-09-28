import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import { AuthService } from '../services/auth.service';
import { autenticadoGuard, visitanteGuard } from './auth.guards';

describe('guards de autenticação', () => {
  const autenticado = signal(false);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { autenticado } }],
    });
  });

  function executar(guard: typeof autenticadoGuard): ReturnType<typeof autenticadoGuard> {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('manda o visitante para o login ao abrir área restrita', () => {
    autenticado.set(false);
    const resultado = executar(autenticadoGuard);

    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/entrar');
  });

  it('libera área restrita com sessão ativa', () => {
    autenticado.set(true);

    expect(executar(autenticadoGuard)).toBe(true);
  });

  it('manda quem já está autenticado do login para o início', () => {
    autenticado.set(true);

    const resultado = executar(visitanteGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/inicio');
  });
});
