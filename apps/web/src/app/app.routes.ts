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
      {
        path: 'pedidos',
        title: `Pedidos · ${TITULO}`,
        loadComponent: () =>
          import('./features/pedidos/lista/lista-pedidos').then((m) => m.ListaPedidos),
      },
      {
        path: 'pedidos/novo',
        title: `Novo pedido · ${TITULO}`,
        loadComponent: () =>
          import('./features/pedidos/novo/novo-pedido').then((m) => m.NovoPedido),
      },
      {
        path: 'pedidos/:id',
        title: `Pedido · ${TITULO}`,
        loadComponent: () =>
          import('./features/pedidos/detalhe/pedido-detalhe').then((m) => m.PedidoDetalhe),
      },
      {
        path: 'producao',
        title: `Produção do dia · ${TITULO}`,
        loadComponent: () => import('./features/producao/producao').then((m) => m.Producao),
      },
      {
        path: 'clientes',
        title: `Clientes · ${TITULO}`,
        loadComponent: () => import('./features/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'produtos',
        title: `Produtos · ${TITULO}`,
        loadComponent: () => import('./features/produtos/produtos').then((m) => m.Produtos),
      },
      {
        path: 'produtores',
        title: `Produtores · ${TITULO}`,
        loadComponent: () => import('./features/produtores/produtores').then((m) => m.Produtores),
      },
      emBreve('relatorios', 'Relatórios'),
    ],
  },
  { path: '**', redirectTo: '' },
];
