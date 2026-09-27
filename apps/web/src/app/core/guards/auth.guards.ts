import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

const TROCA_DE_SENHA = '/trocar-senha';

// A sessão já foi restaurada no inicializador da aplicação quando estes guards
// rodam, então a decisão é síncrona. Eles só orientam a navegação: quem decide
// o acesso é a API, que responde 401 e 403 por conta própria.
export const autenticadoGuard: CanActivateFn = () =>
  inject(AuthService).autenticado() || inject(Router).createUrlTree(['/entrar']);

export const visitanteGuard: CanActivateFn = () =>
  !inject(AuthService).autenticado() || inject(Router).createUrlTree(['/pedidos']);

/** Com senha provisória, toda tela leva à troca de senha. */
export const senhaEmDiaGuard: CanActivateChildFn = (_rota, estado) =>
  !inject(AuthService).precisaTrocarSenha() ||
  estado.url.startsWith(TROCA_DE_SENHA) ||
  inject(Router).createUrlTree([TROCA_DE_SENHA]);

export const adminGuard: CanActivateFn = () =>
  inject(AuthService).ehAdmin() || inject(Router).createUrlTree(['/pedidos']);
