import type { Route, Routes } from '@angular/router';

import { autenticadoGuard, visitanteGuard } from './core/guards/auth.guards';

const TITULO = 'Mira Salgados';

// Destino da navegação ainda sem módulo: a rota existe para que o layout e a
// navegação sejam validados desde já, e cada entrada é trocada pelo módulo real.
function emBreve(path: string, titulo: string): Route {
  return {
    path,
    title: `${titulo} · ${TITULO}`,
    data: { titulo },
    loadComponent: () => import('./features/em-breve/em-breve').then((m) => m.EmBreve),
  };
}

export const routes: Routes = [
  {
    path: 'entrar',
    title: `Entrar · ${TITULO}`,
    canActivate: [visitanteGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [autenticadoGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      emBreve('pedidos', 'Pedidos'),
      emBreve('producao', 'Produção do dia'),
      emBreve('clientes', 'Clientes'),
      emBreve('produtos', 'Produtos'),
      emBreve('produtores', 'Produtores'),
      emBreve('relatorios', 'Relatórios'),
    ],
  },
  { path: '**', redirectTo: '' },
];
