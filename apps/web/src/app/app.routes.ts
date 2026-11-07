import type { Routes } from '@angular/router';

import {
  adminGuard,
  autenticadoGuard,
  senhaEmDiaGuard,
  visitanteGuard,
} from './core/guards/auth.guards';

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
    canActivateChild: [senhaEmDiaGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: `Início · ${TITULO}`,
        loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'trocar-senha',
        title: `Trocar senha · ${TITULO}`,
        loadComponent: () =>
          import('./features/conta/trocar-senha/trocar-senha').then((m) => m.TrocarSenha),
      },
      {
        path: 'usuarios',
        title: `Usuários · ${TITULO}`,
        canActivate: [adminGuard],
        loadComponent: () => import('./features/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'alteracoes',
        title: `Alterações · ${TITULO}`,
        canActivate: [adminGuard],
        loadComponent: () => import('./features/alteracoes/alteracoes').then((m) => m.Alteracoes),
      },
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
          {
            path: 'faturamento',
            title: `Faturamento · ${TITULO}`,
            loadComponent: () =>
              import('./features/relatorios/faturamento/faturamento').then((m) => m.Faturamento),
          },
          {
            path: 'producao',
            title: `A receber por produtor · ${TITULO}`,
            loadComponent: () =>
              import('./features/relatorios/producao-por-produtor/producao-por-produtor').then(
                (m) => m.ProducaoPorProdutor,
              ),
          },
          {
            path: 'itens-vendidos',
            title: `Itens vendidos · ${TITULO}`,
            loadComponent: () =>
              import('./features/relatorios/itens-vendidos/itens-vendidos').then(
                (m) => m.ItensVendidos,
              ),
          },
          {
            path: 'fiados',
            title: `Fiados · ${TITULO}`,
            loadComponent: () =>
              import('./features/relatorios/fiados/fiados').then((m) => m.Fiados),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
