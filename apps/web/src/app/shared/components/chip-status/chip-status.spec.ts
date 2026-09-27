import { TestBed } from '@angular/core/testing';

import { ChipStatus } from './chip-status';

describe('ChipStatus', () => {
  function renderizar(entradas: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(ChipStatus);
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o estado do pedido com o tom do design', () => {
    const chip = renderizar({ status: 'CANCELADO' }).querySelector('ms-chip');

    expect(chip?.textContent.trim()).toBe('Cancelado');
    expect(chip?.classList).toContain('tom-negativo');
  });

  it('mostra o pagamento curto na lista e por extenso no detalhe', () => {
    expect(renderizar({ pagamento: 'PARCIAL' }).textContent.trim()).toBe('Parcial');
    expect(renderizar({ pagamento: 'PARCIAL', extenso: true }).textContent.trim()).toBe(
      'Pagamento parcial',
    );
  });
});
