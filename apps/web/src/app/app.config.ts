import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  type ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

registerLocaleData(localePt, 'pt-BR');

/** Rotas e parâmetros da navegação, sem a query: identifica a tela. */
export function telaDaNavegacao(raiz: ActivatedRouteSnapshot): string {
  const partes: string[] = [];
  for (let rota: ActivatedRouteSnapshot | null = raiz; rota; rota = rota.firstChild) {
    partes.push(`${rota.routeConfig?.path ?? ''}${JSON.stringify(rota.params)}`);
  }
  return partes.join('/');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Datas e números dos pipes do Angular no formato brasileiro.
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Troca de tela com a View Transitions API (styles.css). Filtro, data ou
      // aba que só mudam a query continuam na mesma tela, sem animação.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (telaDaNavegacao(from) === telaDaNavegacao(to)) transition.skipTransition();
        },
      }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    // A primeira navegação espera a tentativa de restaurar a sessão pelo cookie,
    // para que os guards decidam com o estado real.
    provideAppInitializer(() => inject(AuthService).restaurarSessao()),
  ],
};
