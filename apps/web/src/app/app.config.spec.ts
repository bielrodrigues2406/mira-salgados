import type { ActivatedRouteSnapshot } from '@angular/router';

import { telaDaNavegacao } from './app.config';

function rota(
  path: string,
  params: Record<string, string> = {},
  filho: ActivatedRouteSnapshot | null = null,
): ActivatedRouteSnapshot {
  return { routeConfig: { path }, params, firstChild: filho } as ActivatedRouteSnapshot;
}

describe('telaDaNavegacao', () => {
  it('é a mesma tela quando só a query muda', () => {
    const producaoHoje = rota('', {}, rota('producao'));
    const producaoOutroDia = rota('', {}, rota('producao'));

    expect(telaDaNavegacao(producaoHoje)).toBe(telaDaNavegacao(producaoOutroDia));
  });

  it('muda de tela com outra rota ou outro parâmetro', () => {
    const pedido1 = rota('', {}, rota('pedidos/:id', { id: '1' }));
    const pedido2 = rota('', {}, rota('pedidos/:id', { id: '2' }));
    const clientes = rota('', {}, rota('clientes'));

    expect(telaDaNavegacao(pedido1)).not.toBe(telaDaNavegacao(pedido2));
    expect(telaDaNavegacao(pedido1)).not.toBe(telaDaNavegacao(clientes));
  });
});
