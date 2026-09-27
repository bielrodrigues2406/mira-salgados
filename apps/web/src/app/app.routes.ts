import type { Routes } from '@angular/router';

import { autenticadoGuard, visitanteGuard } from './core/guards/auth.guards';

const TITULO = 'Mira Salgados';

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
      {
        path: 'relatorios',
        loadComponent: () => import('./features/relatorios/relatorios').then((m) => m.Relatorios),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'acerto' },
          {
            path: 'acerto',
            title: `Acerto diário · ${TITULO}`,
            loadComponent: () =>
              import('./features/relatorios/acerto/acerto-diario').then((m) => m.AcertoDiario),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
