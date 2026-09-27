import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

// A sessão já foi restaurada no inicializador da aplicação quando estes guards
// rodam, então a decisão é síncrona.
export const autenticadoGuard: CanActivateFn = () =>
  inject(AuthService).autenticado() || inject(Router).createUrlTree(['/entrar']);

export const visitanteGuard: CanActivateFn = () =>
  !inject(AuthService).autenticado() || inject(Router).createUrlTree(['/pedidos']);
