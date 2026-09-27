import { TestBed } from '@angular/core/testing';

import { Icone } from './icone';

describe('Icone', () => {
  function renderizar(nome: 'pedidos' | 'alerta', tamanho?: 16 | 20) {
    const fixture = TestBed.createComponent(Icone);
    fixture.componentRef.setInput('nome', nome);
    if (tamanho) fixture.componentRef.setInput('tamanho', tamanho);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('desenha as formas do ícone escolhido, oculto de leitores de tela', () => {
    const svg = renderizar('pedidos').querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('path')).toHaveLength(2);
    expect(svg?.querySelectorAll('rect')).toHaveLength(1);
  });

  it('mantém o traço em 1,5 px na tela para cada tamanho', () => {
    expect(renderizar('alerta', 16).querySelector('svg')?.getAttribute('stroke-width')).toBe(
      '2.25',
    );
    expect(renderizar('alerta', 20).querySelector('svg')?.getAttribute('stroke-width')).toBe('1.8');
  });
});
